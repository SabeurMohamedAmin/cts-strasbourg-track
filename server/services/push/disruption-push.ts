/**
 * Disruption push fan-out (ROADMAP_NITRO_API 8.4).
 *
 * Reads the disruptions that have not been announced yet, works out which
 * registered devices care, sends one notification each and prunes the tokens
 * FCM rejected as dead.
 *
 * Rules, kept deliberately simple:
 *   - 'info' disruptions stay in-app only; a phone buzzes for 'warning' and
 *     'critical' only. Notification fatigue makes people disable push.
 *   - A disruption with an empty lineIds list is network-wide → everyone.
 *   - Otherwise only devices whose favourite lines intersect it (8.3).
 *   - A row is marked pushed even when nobody was targeted, so the sweep
 *     never reconsiders it.
 */

import { and, gte, inArray, isNull, or } from 'drizzle-orm'
import { devices } from '~~/server/database/schema/devices'
import { disruptions } from '~~/server/database/schema/disruptions'
import { isPushConfigured, sendPushToTokens } from './fcm-client'
import type { PushMessage } from './fcm-client'
import type { DisruptionRow } from '~~/server/database/schema/disruptions'

/** Severities worth interrupting someone for. */
const PUSH_SEVERITIES = ['warning', 'critical'] as const
/** Notification bodies must stay glanceable on a lock screen. */
const MAX_BODY_LENGTH = 140

/** The device fields the targeting rule needs. */
export interface PushTarget {
  fcmToken: string
  favoriteLineIds: string[]
}

/** True when this severity should reach a handset. */
export function shouldPush(severity: DisruptionRow['severity']): boolean {
  return (PUSH_SEVERITIES as readonly string[]).includes(severity)
}

/**
 * Which tokens must receive a disruption affecting `lineIds`.
 * Empty `lineIds` = network-wide, so every device is targeted.
 */
export function selectTargetTokens(lineIds: string[], targets: PushTarget[]): string[] {
  if (lineIds.length === 0) return targets.map(target => target.fcmToken)

  const affected = new Set(lineIds)
  return targets
    .filter(target => target.favoriteLineIds.some(lineId => affected.has(lineId)))
    .map(target => target.fcmToken)
}

/** Builds the FCM payload; `data` lets the app deep-link to the disruption. */
export function buildMessage(row: Pick<DisruptionRow, 'id' | 'title' | 'description' | 'severity'>): PushMessage {
  const body = row.description.length > MAX_BODY_LENGTH
    ? `${row.description.slice(0, MAX_BODY_LENGTH - 1).trimEnd()}\u2026`
    : row.description

  return {
    title: row.title,
    body,
    data: {
      type: 'disruption',
      disruptionId: String(row.id),
      severity: row.severity,
    },
  }
}

/**
 * Sends every pending disruption. Best-effort: logs and returns instead of
 * throwing, so neither the sweep nor an admin request can be taken down.
 */
export async function pushPendingDisruptions(): Promise<void> {
  if (!isPushConfigured()) return

  try {
    // Dynamic import: same guard as db-check.ts / devices-cleanup.ts.
    const { db } = await import('~~/server/database')
    const now = new Date()

    const pending = await db
      .select()
      .from(disruptions)
      .where(and(
        isNull(disruptions.pushedAt),
        inArray(disruptions.severity, [...PUSH_SEVERITIES]),
        // Never announce something that is already over.
        or(isNull(disruptions.endsAt), gte(disruptions.endsAt, now)),
      ))

    if (pending.length === 0) return

    const registered = await db
      .select({ fcmToken: devices.fcmToken, favoriteLineIds: devices.favoriteLineIds })
      .from(devices)

    for (const row of pending) {
      const tokens = selectTargetTokens(row.lineIds, registered)
      const { sent, failed, deadTokens } = await sendPushToTokens(tokens, buildMessage(row))

      if (deadTokens.length) {
        await db.delete(devices).where(inArray(devices.fcmToken, deadTokens))
      }

      // Mark it announced even with zero targets: it must not be retried.
      await db
        .update(disruptions)
        .set({ pushedAt: new Date() })
        .where(inArray(disruptions.id, [row.id]))

      console.info(
        `[disruption-push] Disruption ${row.id}: ${sent} sent, ${failed} failed, `
        + `${deadTokens.length} dead token(s) pruned.`,
      )
    }
  }
  catch (error) {
    console.error('[disruption-push] Fan-out failed', error)
  }
}
