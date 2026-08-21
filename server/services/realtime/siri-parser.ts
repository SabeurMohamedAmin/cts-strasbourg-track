/**
 * SIRI 2.0 EstimatedTimetable → ParsedVehicle[] parser.
 *
 * Accepts BOTH response formats via siri-document.ts:
 *   - JSON — what the CTS API actually returns (matches its Swagger schemas)
 *   - XML  — classic SIRI, kept for compatibility
 *
 * Field mapping  SIRI → LiveVehicle:
 *   VehicleRef / DatedVehicleJourneyRef → id (prefixed "cts-"; CTS journeys
 *                                          often have no VehicleRef at all)
 *   LineRef                             → lineId
 *   PublishedLineName / LineRef         → lineLabel
 *   VehicleMode / LineRef heuristic     → mode
 *   DestinationName                     → destination
 *   VehicleLocation                     → latitude / longitude (rare on CTS)
 *   RecordedAtTime                      → recordedAt
 *   Expected vs Aimed at next stop      → delaySeconds
 *   (hardcoded)                         → status: 'live'
 *
 * Full call sequence (position interpolation):
 *   CTS does NOT provide GPS coordinates, so the vehicle position must be
 *   DERIVED from the call times. This parser therefore extracts the whole
 *   call list — RecordedCalls (stops already passed) followed by
 *   EstimatedCalls (upcoming stops) — as `calls: ParsedCall[]`.
 *   The poller turns those into timed points and interpolates the position
 *   between the last passed stop and the next one (see live-position.ts).
 */

import type { LiveVehicle } from '~~/shared/types/vehicle'
import { asArray, listOf, parseSiriDocument, prop, text } from './siri-document'

function float(val: unknown): number | undefined {
  const n = Number(val)
  return Number.isFinite(n) ? n : undefined
}

/**
 * Fallback mode detection from the LineRef, used only when the feed does
 * not carry an explicit VehicleMode field.
 */
export function modeFromLineRef(lineRef: string): 'tram' | 'bus' {
  const upper = lineRef.toUpperCase()
  if (upper.includes('TRAM') || upper.startsWith('C_TRAM')) return 'tram'
  return 'bus'
}

/**
 * Derive a human-readable line label from the LineRef.
 * Strips common CTS prefixes like "CTS:", "C_", "TRAM_" etc.
 * Falls back to the raw lineRef if nothing matches.
 */
export function labelFromLineRef(lineRef: string): string {
  return lineRef
    .replace(/^CTS:/i, '')
    .replace(/^C_TRAM_/i, '')
    .replace(/^C_/i, '')
    .replace(/^TRAM_/i, '')
    .replace(/^BUS_/i, '')
    || lineRef
}

/**
 * Resolve the transport mode: prefer the explicit VehicleMode field
 * (top-level or inside Extension), fall back to the LineRef heuristic.
 * CTS LineRefs are bare labels like "A" or "6", so the heuristic alone
 * would misclassify tram lines as buses.
 */
export function resolveMode(journey: any, lineRef: string): 'tram' | 'bus' {
  const modeText = (
    text(prop(journey, 'VehicleMode'))
    || text(prop(prop(journey, 'Extension'), 'VehicleMode'))
  ).toLowerCase()

  if (modeText.includes('tram')) return 'tram'
  if (modeText.includes('bus')) return 'bus'
  return modeFromLineRef(lineRef)
}

/** One stop call of a vehicle journey, in stop order. */
export interface ParsedCall {
  stopRef: string
  stopName: string
  /** Timetabled arrival, when provided. ISO 8601 or null. */
  aimedArrival: string | null
  /** Best known arrival (Actual > Expected > Aimed). ISO 8601 or null. */
  expectedArrival: string | null
  /** Best known departure (Actual > Expected > Aimed). ISO 8601 or null. */
  expectedDeparture: string | null
  /** true when parsed from RecordedCalls (stop already passed). */
  recorded: boolean
}

/** Intermediary used internally; lat/lon may be null (position derived by poller). */
export interface ParsedVehicle extends Omit<LiveVehicle, 'latitude' | 'longitude'> {
  latitude: number | null
  longitude: number | null
  /** CTS StopPointRef of the next stop (first non-recorded call). */
  nextStopRef: string | null
  /** Full call sequence: recorded (passed) stops first, then estimated. */
  calls: ParsedCall[]
}

/**
 * Parse one RecordedCall / EstimatedCall node.
 * Returns null when the node has no stop reference or no usable time.
 */
function parseCall(node: any, recorded: boolean): ParsedCall | null {
  const get = (k: string) => prop(node, k)

  const stopRef = text(get('StopPointRef'))
  if (!stopRef) return null

  const aimedArrival = text(get('AimedArrivalTime') ?? get('AimedDepartureTime')) || null
  const expectedArrival = text(
    get('ActualArrivalTime') ?? get('ExpectedArrivalTime') ?? get('AimedArrivalTime'),
  ) || null
  const expectedDeparture = text(
    get('ActualDepartureTime') ?? get('ExpectedDepartureTime') ?? get('AimedDepartureTime'),
  ) || null

  if (!expectedArrival && !expectedDeparture) return null

  return {
    stopRef,
    stopName: text(get('StopPointName')),
    aimedArrival,
    expectedArrival,
    expectedDeparture,
    recorded,
  }
}

export function parseSiriEstimatedTimetable(xml: string): ParsedVehicle[] {
  const root = parseSiriDocument(xml)
  if (!root) return []

  // JSON: { ServiceDelivery: … }   XML: <Siri><ServiceDelivery>…
  const siri = prop(root, 'Siri') ?? root
  const serviceDelivery = prop(siri, 'ServiceDelivery')

  const journeys: any[] = asArray(prop(serviceDelivery, 'EstimatedTimetableDelivery'))
    .flatMap(delivery => asArray(prop(delivery, 'EstimatedJourneyVersionFrame')))
    .flatMap(frame => asArray(prop(frame, 'EstimatedVehicleJourney')))

  const vehicles: ParsedVehicle[] = []
  const now = new Date().toISOString()

  for (const j of journeys) {
    const get = (k: string) => prop(j, k)

    const lineRef = text(get('LineRef'))
    if (!lineRef) continue

    const recordedAt = text(get('RecordedAtTime')) || now

    // GPS coordinates — CTS almost never sends these, but honour them if present.
    const locNode = get('VehicleLocation')
    const latitude = float(prop(locNode, 'Latitude'))
    const longitude = float(prop(locNode, 'Longitude'))

    // Full call sequence: passed stops first, then upcoming stops.
    const calls: ParsedCall[] = [
      ...listOf(j, 'RecordedCalls', 'RecordedCall').map(c => parseCall(c, true)),
      ...listOf(j, 'EstimatedCalls', 'EstimatedCall').map(c => parseCall(c, false)),
    ].filter((c): c is ParsedCall => c !== null)

    // Skip entirely if we have no GPS and no calls to derive a position from.
    if (latitude === undefined && calls.length === 0) continue

    // Journey identity: CTS often omits VehicleRef, so fall back to the
    // dated journey ref, then to a synthetic line + first-call key.
    const framed = get('FramedVehicleJourneyRef')
    let journeyId = text(get('VehicleRef'))
      || text(prop(framed, 'DatedVehicleJourneyRef'))
    if (!journeyId) {
      const anchor = calls[0]
      if (!anchor) continue
      journeyId = `${lineRef}-${anchor.stopRef}-${anchor.expectedArrival ?? anchor.expectedDeparture ?? ''}`
    }

    // Next stop = first call that has not been passed yet.
    const nextCall = calls.find(c => !c.recorded) ?? null

    // Real-time delay at the next stop (expected vs timetabled).
    let delaySeconds: number | undefined
    if (nextCall?.aimedArrival && nextCall.expectedArrival) {
      const d = (Date.parse(nextCall.expectedArrival) - Date.parse(nextCall.aimedArrival)) / 1_000
      if (Number.isFinite(d)) delaySeconds = Math.round(d)
    }

    const destination = text(
      get('DestinationName') ?? get('DestinationShortName') ?? get('DestinationDisplay'),
    ) || nextCall?.stopName || 'Inconnu'

    vehicles.push({
      id: `cts-${journeyId}`,
      mode: resolveMode(j, lineRef),
      lineId: lineRef,
      lineLabel: text(get('PublishedLineName')) || labelFromLineRef(lineRef),
      destination,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      status: 'live',
      delaySeconds,
      recordedAt,
      nextStop: nextCall
        ? {
            id: nextCall.stopRef,
            name: nextCall.stopName || nextCall.stopRef,
            expectedArrival: nextCall.expectedArrival || undefined,
          }
        : undefined,
      nextStopRef: nextCall?.stopRef ?? null,
      calls,
    })
  }

  return vehicles
}
