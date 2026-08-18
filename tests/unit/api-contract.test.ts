import { describe, expect, it } from 'vitest'
import { openApiSpec } from '~~/server/services/openapi-spec'

/**
 * Contract test (ROADMAP_NITRO_API 6.5) — guards the frozen v1 surface.
 *
 * Runs locally before every MR (no pipeline). It fails when:
 *   - a public endpoint is added to the server but missing from the spec, or
 *   - the spec documents a path the server no longer serves.
 *
 * Keep this list in sync with server/api/**. It is the human-reviewed list of
 * the PUBLIC v1 surface (ROADMAP_NITRO_API 1.5) — admin endpoints are
 * intentionally absent (they are never part of v1).
 */

/** Every public v1 path the spec MUST document. */
const EXPECTED_V1_PATHS = [
  '/health',
  '/openapi.json',
  '/stops',
  '/stops/{id}',
  '/stops/{id}/arrivals',
  '/stops/{id}/next-departures',
  '/stops/arrivals',
  '/stops/nearby',
  '/vehicles',
  '/stream/vehicles',
  '/routes',
  '/routes/{id}/shape',
  '/routes/shapes',
  '/stations/{slug}/schedule',
  '/geocode',
  '/eurometropole/bounds',
  '/blog',
  '/blog/{slug}',
  '/disruptions',
  '/devices',
  '/track',
] as const

describe('OpenAPI v1 contract', () => {
  const documentedPaths = Object.keys(openApiSpec.paths)

  it('documents every public v1 endpoint', () => {
    for (const path of EXPECTED_V1_PATHS) {
      expect(documentedPaths, `missing ${path} in openApiSpec.paths`).toContain(path)
    }
  })

  it('documents nothing outside the reviewed v1 surface', () => {
    for (const path of documentedPaths) {
      expect(EXPECTED_V1_PATHS, `unexpected ${path} in openApiSpec.paths`).toContain(path)
    }
  })

  it('never exposes the admin area in v1', () => {
    expect(documentedPaths.some(path => path.includes('admin'))).toBe(false)
  })

  it('uses the frozen error shape for documented errors', () => {
    const apiError = openApiSpec.components.schemas.ApiError
    expect(apiError.required).toEqual(['statusCode', 'code', 'message'])
  })

  it('pins the spec to OpenAPI 3 and version 1', () => {
    expect(openApiSpec.openapi).toBe('3.0.3')
    expect(openApiSpec.info.version).toBe('1.0.0')
    expect(openApiSpec.servers[0]?.url).toBe('/api/v1')
  })
})
