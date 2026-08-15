import { onMounted, onUnmounted } from 'vue'

/**
 * Reactive shared clock.
 *
 * Provides a reactive `now` timestamp (in milliseconds) that updates every
 * 10 seconds. Components using `now` automatically re-evaluate computed
 * properties and template bindings (such as relative countdowns) as time
 * passes.
 *
 * The value lives in `useState`, NOT in a module-scope ref. A module-scope ref
 * is created once per SERVER PROCESS and is only refreshed from `onMounted`,
 * which never runs during SSR: every server render therefore used the time the
 * server booted (shared by all requests), and the browser recomputed the same
 * countdowns with the real time, breaking hydration on every page showing a
 * departure. `useState` is per-request on the server and travels through the
 * payload, so the first client render uses the exact same instant as the
 * server render.
 *
 * The timer itself stays at module scope, so every subscriber shares one single
 * interval: the first mounted component starts it, the last unmounted one stops
 * it. Without this, a list of 30 arrival rows would run 30 parallel timers all
 * writing the same value.
 *
 * Note: this composable intentionally shadows `useNow` from @vueuse/core in
 * Nuxt auto-imports — the VueUse version creates one timer per caller.
 */

const TICK_MS = 10_000

let timer: ReturnType<typeof setInterval> | undefined
let subscriberCount = 0

export function useNow() {
  const now = useState('app-now', () => Date.now())

  // onMounted never runs during SSR, so the timer only exists in the browser.
  onMounted(() => {
    subscriberCount++
    if (!timer) {
      now.value = Date.now() // fresh value for the first subscriber
      timer = setInterval(() => {
        now.value = Date.now()
      }, TICK_MS)
    }
  })

  onUnmounted(() => {
    subscriberCount--
    if (subscriberCount <= 0 && timer) {
      clearInterval(timer)
      timer = undefined
    }
  })

  return { now }
}
