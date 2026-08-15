import { stationScheduleKey, stationScheduleUrl } from '~/composables/useStationSchedule'

/**
 * Warms the timetable of the stations the reader can see.
 *
 * NuxtLink prefetches the routes entering the viewport on its own, and tells us
 * about each one through the `link:prefetch` hook. Every dot of the route bar is
 * a NuxtLink, so we download that station's timetable into Nuxt's payload cache,
 * which is exactly where useStationSchedule reads it from: clicking the dot then
 * shows the station immediately.
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('link:prefetch', async (to) => {
    const slug = to.match(/^\/station\/([^/?#]+)/)?.[1]
    if (!slug) return

    const key = stationScheduleKey(decodeURIComponent(slug))
    if (nuxtApp.payload.data[key]) return

    nuxtApp.payload.data[key] = await $fetch(stationScheduleUrl(decodeURIComponent(slug)))
  })
})
