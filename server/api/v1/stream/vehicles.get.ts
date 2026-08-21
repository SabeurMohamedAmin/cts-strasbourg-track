// v1 alias of /api/stream/vehicles — see server/middleware/api-version.ts.
// Must be a real handler, not a proxy: the SSE stream writes to
// event.node.res directly and a proxy hop swallows it (204, empty body).
export { default } from '../../stream/vehicles.get'
