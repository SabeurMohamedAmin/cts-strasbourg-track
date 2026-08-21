/**
 * Nitro server plugin — starts the CTS real-time poller on server boot.
 *
 * This file is auto-registered by Nitro as a server plugin because it
 * lives in server/plugins/. It runs exactly once per server process
 * (never on the client) immediately after Nitro initialises.
 *
 * The poller checks for NUXT_CTS_API_TOKEN and is a no-op if the token
 * is not configured — safe to deploy without a token for local dev.
 */

import { startPoller } from '../services/realtime/poller'

export default defineNitroPlugin(() => {
  startPoller()
})
