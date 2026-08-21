/**
 * siri-document.ts — format-agnostic SIRI response helpers.
 *
 * The CTS API answers in JSON (its native format — the Swagger schemas are
 * JSON models) regardless of the Accept header, but classic SIRI feeds are
 * XML. All parsers go through these helpers so they work with either:
 *
 *   parseSiriDocument()  raw body → plain JS object (JSON.parse or XML)
 *   prop()               key access tolerant of "siri:" namespace prefixes
 *   asArray()            single-object vs array normalisation — JSON uses
 *                        real arrays, XML repeats elements
 *   listOf()             wrapped lists: XML nests <EstimatedCalls>
 *                        <EstimatedCall>… while CTS JSON often flattens to
 *                        "EstimatedCalls": […]
 *   text()               value extraction: strings, numbers, {value} /
 *                        {#text} objects, and single-element arrays
 */

import { XMLParser } from 'fast-xml-parser'

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseTagValue: true,
  parseAttributeValue: true,
  isArray: name => [
    'EstimatedVehicleJourney',
    'EstimatedCall',
    'RecordedCall',
    'StopMonitoringDelivery',
    'MonitoredStopVisit',
  ].includes(name),
})

/** Parse a raw SIRI body — JSON or XML — into a plain object, or null. */
export function parseSiriDocument(raw: string): any | null {
  const trimmed = raw.trimStart()
  try {
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return JSON.parse(trimmed)
    }
    return xmlParser.parse(trimmed)
  }
  catch (err) {
    console.error('[siri-document] Could not parse SIRI response:', err)
    return null
  }
}

/** Read node[key], tolerating the "siri:" namespace prefix XML may add. */
export function prop(node: any, key: string): any {
  if (node === null || typeof node !== 'object') return undefined
  return node[key] ?? node[`siri:${key}`]
}

/** Normalise "one element vs many": always work with an array. */
export function asArray(value: any): any[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

/**
 * Read a possibly-wrapped list.
 *   XML:  <EstimatedCalls><EstimatedCall>…</EstimatedCall>…</EstimatedCalls>
 *   JSON: "EstimatedCalls": [ … ]           (flattened, no inner wrapper)
 */
export function listOf(node: any, wrapper: string, item: string): any[] {
  const wrapped = prop(node, wrapper)
  if (Array.isArray(wrapped)) return wrapped
  return asArray(prop(wrapped, item))
}

/** Coerce a SIRI value to a trimmed string ("" when absent). */
export function text(val: unknown): string {
  if (typeof val === 'string') return val.trim()
  if (typeof val === 'number') return String(val)
  if (Array.isArray(val)) return text(val[0])
  if (val && typeof val === 'object') {
    // SIRI sometimes represents labels as { value: "…", lang: "FR" };
    // fast-xml-parser can produce { "#text": "…" } for mixed content.
    const record = val as Record<string, unknown>
    return text(record.value ?? record['#text'])
  }
  return ''
}
