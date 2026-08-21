/**
 * vehicle-tween.ts — dead-reckoning decision logic for first-seen vehicles.
 *
 * Problem: the map tween needs a previous position to animate from, so a
 * vehicle used to stand still until the SECOND snapshot arrived (~12 s poll
 * interval).
 *
 * Fix: the server ships `pathAhead` — the forward geometry from the
 * vehicle's current position to its next stop. On first sighting the client
 * walks that path with duration = next-stop ETA − now, which matches the
 * server's own interpolation speed. The correction applied when the next
 * real snapshot arrives therefore stays tiny.
 *
 * Pure functions only (no map, no store, no Date.now() inside) so this
 * module is trivially unit-testable.
 */

import type { LiveVehicle } from '~~/shared/types/vehicle'

/** Never animate an initial tween shorter than this — avoids a visual jump. */
export const MIN_INITIAL_TWEEN_MS = 1_000
/** Cap the walk so a wildly wrong ETA cannot freeze a marker mid-segment. */
export const MAX_INITIAL_TWEEN_MS = 120_000

export interface InitialTween {
  /** Ordered [lon, lat] waypoints to walk, starting at the vehicle position. */
  path: [number, number][]
  /** How long the walk should take, in milliseconds. */
  durationMs: number
}

/**
 * Decide whether (and how) a vehicle seen for the FIRST time should move.
 *
 * Returns `null` when the vehicle must stay put:
 * - no `pathAhead` — the server says it is dwelling, or has no geometry
 * - no usable next-stop ETA — nothing to pace the walk against
 * - ETA already passed — the next snapshot will re-place it anyway
 *
 * @param vehicle  The vehicle as received in its first snapshot.
 * @param nowMs    Current wall-clock time (epoch ms), injected for testability.
 */
export function initialVehicleTween(
  vehicle: LiveVehicle,
  nowMs: number,
): InitialTween | null {
  const path = vehicle.pathAhead
  if (!path || path.length < 2) return null

  const eta = vehicle.nextStop?.expectedArrival
  if (!eta) return null

  const etaMs = Date.parse(eta)
  if (!Number.isFinite(etaMs)) return null

  const remainingMs = etaMs - nowMs
  if (remainingMs <= 0) return null

  return {
    path,
    durationMs: Math.min(
      MAX_INITIAL_TWEEN_MS,
      Math.max(MIN_INITIAL_TWEEN_MS, remainingMs),
    ),
  }
}
