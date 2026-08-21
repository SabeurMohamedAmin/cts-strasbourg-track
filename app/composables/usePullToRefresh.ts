interface PullToRefreshOptions {
  onRefresh: () => Promise<void>
  threshold?: number
  maxDistance?: number
}

/**
 * Adds a touch-only pull-to-refresh gesture to an existing scroll container.
 * The gesture starts only at the top of the container and ignores horizontal
 * swipes, so regular scrolling and carousels keep their native behaviour.
 */
export function usePullToRefresh(
  target: Readonly<Ref<HTMLElement | null>>,
  options: PullToRefreshOptions,
) {
  const threshold = options.threshold ?? 72
  const maxDistance = options.maxDistance ?? 112
  const pullDistance = ref(0)
  const isRefreshing = ref(false)

  let startX = 0
  let startY = 0
  let isTracking = false

  const progress = computed(() => Math.min(pullDistance.value / threshold, 1))
  const isReady = computed(() => pullDistance.value >= threshold)
  const isVisible = computed(() => pullDistance.value > 0 || isRefreshing.value)

  function reset() {
    isTracking = false
    pullDistance.value = 0
  }

  function handleTouchStart(event: TouchEvent) {
    const container = target.value
    const touch = event.touches[0]
    if (!container || !touch || container.scrollTop > 0 || isRefreshing.value) return

    startX = touch.clientX
    startY = touch.clientY
    isTracking = true
  }

  function handleTouchMove(event: TouchEvent) {
    if (!isTracking) return

    const touch = event.touches[0]
    if (!touch) return

    const deltaX = touch.clientX - startX
    const deltaY = touch.clientY - startY
    if (deltaY <= 0 || Math.abs(deltaX) > deltaY) {
      reset()
      return
    }

    // Resistance keeps the gesture controlled while still feeling responsive.
    pullDistance.value = Math.min(maxDistance, deltaY * 0.55)
    if (event.cancelable) event.preventDefault()
  }

  async function handleTouchEnd() {
    if (!isTracking) return

    const shouldRefresh = isReady.value
    isTracking = false
    if (!shouldRefresh) {
      pullDistance.value = 0
      return
    }

    isRefreshing.value = true
    pullDistance.value = threshold
    try {
      await options.onRefresh()
    }
    finally {
      isRefreshing.value = false
      pullDistance.value = 0
    }
  }

  onMounted(() => {
    const container = target.value
    container?.addEventListener('touchstart', handleTouchStart, { passive: true })
    container?.addEventListener('touchmove', handleTouchMove, { passive: false })
    container?.addEventListener('touchend', handleTouchEnd, { passive: true })
    container?.addEventListener('touchcancel', reset, { passive: true })
  })

  onBeforeUnmount(() => {
    const container = target.value
    container?.removeEventListener('touchstart', handleTouchStart)
    container?.removeEventListener('touchmove', handleTouchMove)
    container?.removeEventListener('touchend', handleTouchEnd)
    container?.removeEventListener('touchcancel', reset)
  })

  return { pullDistance, progress, isReady, isVisible, isRefreshing }
}
