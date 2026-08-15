/**
 * SIRI 2.0 StopMonitoring → MonitoredArrival[] parser.
 *
 * Accepts BOTH response formats via siri-document.ts:
 *   - JSON — what the CTS API actually returns
 *   - XML  — classic SIRI, kept for compatibility
 *
 * The StopMonitoring service is stop-centric: it returns one
 * MonitoredStopVisit per upcoming vehicle at the requested stop.
 *
 * Path (JSON keys; XML adds a Siri wrapper and optional siri: prefixes):
 *   ServiceDelivery > StopMonitoringDelivery[] > MonitoredStopVisit[]
 *     > MonitoredVehicleJourney
 *         LineRef, PublishedLineName, DestinationName, VehicleMode,
 *         FramedVehicleJourneyRef > DatedVehicleJourneyRef,
 *         MonitoredCall > AimedArrivalTime / ExpectedArrivalTime
 *
 * Visits without any usable time (neither Expected nor Aimed) are skipped —
 * there is nothing meaningful to display for them.
 */

import { asArray, parseSiriDocument, prop, text } from './siri-document'
import { labelFromLineRef, resolveMode } from './siri-parser'

/** One real-time departure at a monitored stop. */
export interface MonitoredArrival {
  /** Stable-ish key: DatedVehicleJourneyRef, else lineRef + time. */
  journeyRef: string
  /** Raw CTS LineRef (e.g. "A", "C_TRAM_A"). */
  lineRef: string
  /** Human-readable line label (e.g. "A", "6"). */
  lineLabel: string
  mode: 'bus' | 'tram'
  /** Final destination shown on the vehicle. */
  destination: string
  /** Best known arrival time — Expected, falling back to Aimed. ISO 8601. */
  expectedArrival: string
  /** Original timetabled time when provided by CTS. ISO 8601 or null. */
  aimedArrival: string | null
}

export function parseSiriStopMonitoring(xml: string): MonitoredArrival[] {
  const root = parseSiriDocument(xml)
  if (!root) return []

  const siri = prop(root, 'Siri') ?? root
  const serviceDelivery = prop(siri, 'ServiceDelivery')

  const arrivals: MonitoredArrival[] = []

  for (const delivery of asArray(prop(serviceDelivery, 'StopMonitoringDelivery'))) {
    for (const visit of asArray(prop(delivery, 'MonitoredStopVisit'))) {
      const journey = prop(visit, 'MonitoredVehicleJourney')
      if (!journey) continue

      const get = (k: string) => prop(journey, k)

      const lineRef = text(get('LineRef'))
      if (!lineRef) continue

      // MonitoredCall holds the times for THIS stop.
      const call = get('MonitoredCall')
      const getCall = (k: string) => prop(call, k)

      const expected = text(
        getCall('ExpectedArrivalTime') ?? getCall('ExpectedDepartureTime'),
      )
      const aimed = text(
        getCall('AimedArrivalTime') ?? getCall('AimedDepartureTime'),
      )
      const bestTime = expected || aimed
      if (!bestTime) continue

      // DatedVehicleJourneyRef uniquely identifies the trip for the day.
      const datedRef = text(
        prop(get('FramedVehicleJourneyRef'), 'DatedVehicleJourneyRef'),
      )

      const destination = text(
        get('DestinationName') ?? get('DestinationShortName') ?? getCall('DestinationDisplay'),
      ) || 'Inconnu'

      arrivals.push({
        journeyRef: datedRef || `${lineRef}-${bestTime}`,
        lineRef,
        lineLabel: text(get('PublishedLineName')) || labelFromLineRef(lineRef),
        mode: resolveMode(journey, lineRef),
        destination,
        expectedArrival: bestTime,
        aimedArrival: aimed || null,
      })
    }
  }

  // Soonest first.
  arrivals.sort((a, b) => a.expectedArrival.localeCompare(b.expectedArrival))
  return arrivals
}
