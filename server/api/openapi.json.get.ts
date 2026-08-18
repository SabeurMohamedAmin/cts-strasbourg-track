/**
 * GET /api/v1/openapi.json (ROADMAP_NITRO_API 2.6).
 *
 * Serves the OpenAPI 3 spec (docs/openapi.yaml) as JSON so tooling — the
 * Dart client generator (7.1), Swagger UI, contract tests — can fetch it
 * from the running server instead of parsing YAML.
 *
 * The spec is frozen with v1 (2.7): it only changes when the contract does.
 * Cached aggressively; it is static documentation.
 */
import { openApiSpec } from '../services/openapi-spec'

export default defineEventHandler((event) => {
  setResponseHeader(event, 'Content-Type', 'application/json')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600, immutable')
  return openApiSpec
})
