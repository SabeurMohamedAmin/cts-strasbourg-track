/**
 * Shared page-visibility composable.
 *
 * Provides a reactive `isVisible` ref that is true when the browser tab is
 * visible and false when it is hidden.
 *
 * SSR-safe: `document` is only accessed inside onMounted / event handlers,
 * never at module-evaluation time.  On the server the ref starts as `true`
 * (treated as visible) and the visibilitychange listener is never registered.
 *
 * Usage:
 *   const { isVisible } = usePageVisibility()
 *   watch(isVisible, (visible) => visible ? resume() : pause())
 */
export function usePageVisibility() {
  // Default to true — on the server there is no document, so we treat the
  // environment as "visible" and let the client hydrate the real state.
  const isVisible = ref(true)

  function onVisibilityChange() {
    isVisible.value = !document.hidden
  }

  onMounted(() => {
    // Now we are guaranteed to be in the browser — read the real initial state.
    isVisible.value = !document.hidden
    document.addEventListener('visibilitychange', onVisibilityChange)
  })

  onUnmounted(() => {
    document.removeEventListener('visibilitychange', onVisibilityChange)
  })

  return { isVisible }
}
