/**
 * Firebase Cloud Messaging sender — FCM HTTP v1 (ROADMAP_NITRO_API 8.4).
 *
 * Server-side ONLY: the service-account credentials live in runtimeConfig
 * (NUXT_FCM_*) and never reach a client. Nothing here is imported by the
 * app bundle.
 *
 * Why hand-rolled instead of firebase-admin: HTTP v1 needs exactly two
 * things — an OAuth access token obtained by signing a JWT with the service
 * account key, then one POST per device token. node:crypto covers the
 * signing, so we avoid a heavy dependency in the Nitro bundle.
 *
 * FCM tokens are device identifiers: they are NEVER logged.
 */

import { createSign } from 'node:crypto'

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/firebase.messaging'
/** Google caps assertion lifetime at 1 hour. */
const ASSERTION_TTL_S = 3_600
/** Refresh a little early so a request never races the expiry. */
const REFRESH_MARGIN_MS = 60_000
/** Polite fan-out: a handful of parallel sends, not hundreds. */
const SEND_CONCURRENCY = 5

interface ServiceAccount {
  projectId: string
  clientEmail: string
  privateKey: string
}

/** Notification to deliver; `data` values must be strings (FCM requirement). */
export interface PushMessage {
  title: string
  body: string
  data?: Record<string, string>
}

export interface PushResult {
  sent: number
  failed: number
  /** Tokens FCM rejected permanently — the caller should delete these rows. */
  deadTokens: string[]
}

function readServiceAccount(): ServiceAccount | null {
  const config = useRuntimeConfig()
  const projectId = (config.fcmProjectId as string) || ''
  const clientEmail = (config.fcmClientEmail as string) || ''
  // Env vars carry the PEM with literal \n sequences; restore real newlines.
  const privateKey = ((config.fcmPrivateKey as string) || '').replace(/\\n/g, '\n')

  if (!projectId || !clientEmail || !privateKey) return null
  return { projectId, clientEmail, privateKey }
}

/** True once all three NUXT_FCM_* values are set. */
export function isPushConfigured(): boolean {
  return readServiceAccount() !== null
}

const base64url = (value: string): string => Buffer.from(value).toString('base64url')

let cachedToken: { value: string, expiresAt: number } | null = null

/** Exchanges a signed JWT for an OAuth access token, cached until it expires. */
async function getAccessToken(account: ServiceAccount): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt - REFRESH_MARGIN_MS) {
    return cachedToken.value
  }

  const issuedAt = Math.floor(Date.now() / 1_000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(JSON.stringify({
    iss: account.clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: issuedAt,
    exp: issuedAt + ASSERTION_TTL_S,
  }))
  const signature = createSign('RSA-SHA256')
    .update(`${header}.${claims}`)
    .sign(account.privateKey, 'base64url')

  const response = await $fetch<{ access_token: string, expires_in: number }>(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${header}.${claims}.${signature}`,
    }).toString(),
  })

  cachedToken = {
    value: response.access_token,
    expiresAt: Date.now() + response.expires_in * 1_000,
  }
  return cachedToken.value
}

/** HTTP status of an ofetch error, whatever shape it arrives in. */
function errorStatus(error: unknown): number {
  const candidate = error as { statusCode?: number, status?: number, response?: { status?: number } }
  return candidate.statusCode ?? candidate.status ?? candidate.response?.status ?? 0
}

type SendOutcome = 'sent' | 'dead' | 'failed'

async function sendOne(
  account: ServiceAccount,
  accessToken: string,
  token: string,
  message: PushMessage,
): Promise<SendOutcome> {
  try {
    await $fetch(`https://fcm.googleapis.com/v1/projects/${account.projectId}/messages:send`, {
      method: 'POST',
      headers: { authorization: `Bearer ${accessToken}` },
      body: {
        message: {
          token,
          notification: { title: message.title, body: message.body },
          data: message.data,
        },
      },
    })
    return 'sent'
  }
  catch (error) {
    const status = errorStatus(error)
    // 404 UNREGISTERED (app uninstalled, token rotated) and 400
    // INVALID_ARGUMENT (malformed token) will never succeed: prune the row.
    if (status === 404 || status === 400) return 'dead'
    // 401/429/5xx are transient — the next sweep retries. Log without the token.
    console.error(`[fcm] Send failed with status ${status}`)
    return 'failed'
  }
}

/**
 * Fans a message out to every token. Never throws: push is best-effort and
 * must not break the caller (the sweep, or an admin request).
 */
export async function sendPushToTokens(tokens: string[], message: PushMessage): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, deadTokens: [] }

  const account = readServiceAccount()
  if (!account || tokens.length === 0) return result

  let accessToken: string
  try {
    accessToken = await getAccessToken(account)
  }
  catch (error) {
    console.error('[fcm] Could not obtain an access token', error)
    result.failed = tokens.length
    return result
  }

  // Small sequential batches keep memory flat and stay well inside FCM quotas.
  for (let start = 0; start < tokens.length; start += SEND_CONCURRENCY) {
    const batch = tokens.slice(start, start + SEND_CONCURRENCY)
    const outcomes = await Promise.all(
      batch.map(token => sendOne(account, accessToken, token, message)),
    )

    outcomes.forEach((outcome, index) => {
      if (outcome === 'sent') result.sent += 1
      else if (outcome === 'dead') result.deadTokens.push(batch[index]!)
      else result.failed += 1
    })
  }

  return result
}

/** Test helper: forget the cached OAuth token. */
export function resetAccessTokenCache(): void {
  cachedToken = null
}
