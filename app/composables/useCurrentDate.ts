/**
 * useCurrentDate
 *
 * Provides the current calendar date as a reactive label / icon / color
 * triple, mirroring the shape returned by useConnectionStatus() so both
 * chips share the same wiring pattern.
 *
 * Hydration safety: the label starts as a '--/--/----' placeholder on
 * both server and client (same trick as the header clock), then resolves
 * once mounted. A 60 s interval keeps it correct across midnight for
 * long-lived sessions.
 */
export function useCurrentDate() {
  /** Formatted date, e.g. "16/07/2026" (day/month/year, fr-FR). */
  const dateLabel = ref('--/--/----')

  /** Static presentation, kept here so the component stays dumb. */
  const dateIcon = 'mdi-calendar-month-outline'
  const dateColor = 'secondary'

  function refresh() {
    dateLabel.value = new Date().toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  let timer: ReturnType<typeof setInterval> | undefined
  onMounted(() => {
    refresh()
    timer = setInterval(refresh, 60_000)
  })
  onUnmounted(() => clearInterval(timer))

  return { dateLabel, dateIcon, dateColor }
}
