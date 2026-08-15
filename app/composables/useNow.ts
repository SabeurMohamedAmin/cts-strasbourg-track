import { onMounted, onUnmounted, ref } from 'vue'

/**
 * Reactive shared clock.
 *
 * Provides a reactive `now` timestamp (in milliseconds) that updates every
 * 10 seconds. Components using `now` automatically re-evaluate computed
 * properties and template bindings (such as relative countdowns) as time
 * passes.
 *
 * The ref and its timer live at MODULE scope, so every subscriber shares one
 * single interval: the first mounted component starts it, the last unmounted
 * one stops it. Without this, a list of 30 arrival rows would run 30 parallel
 * timers all writing the same value.
 *
 * Note: this composable intentionally shadows `useNow` from @vueuse/core in
 * Nuxt auto-imports — the VueUse version creates one timer per caller.
 */

const TICK_MS = 10_000

const now = ref(Date.now())
let timer: ReturnType<typeof setInterval> | undefined
let subscriberCount = 0

export function useNow() {
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
