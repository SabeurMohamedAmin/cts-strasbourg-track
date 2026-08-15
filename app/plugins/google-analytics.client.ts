type GtagCommand = 'config' | 'event' | 'js'
type GtagArguments = [GtagCommand, string | Date, Record<string, unknown>?]

declare global {
  interface Window {
    dataLayer: GtagArguments[]
    gtag: (...args: GtagArguments) => void
  }
}

export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig()
  const measurementId = config.public.googleAnalyticsId

  if (!measurementId) return

  let isReady = false
  let lastTrackedPath = ''

  function trackPageView() {
    if (!isReady) return

    const path = window.location.pathname + window.location.search
    if (path === lastTrackedPath) return

    lastTrackedPath = path
    window.gtag('event', 'page_view', {
      page_location: window.location.href,
      page_path: path,
      page_title: document.title,
    })
  }

  function loadGoogleAnalytics() {
    const scriptId = 'google-analytics'

    if (document.getElementById(scriptId)) return

    window.dataLayer = window.dataLayer || []
    window.gtag = (...args: GtagArguments) => window.dataLayer.push(args)

    window.gtag('js', new Date())
    window.gtag('config', measurementId, { send_page_view: false })

    const script = document.createElement('script')
    script.id = scriptId
    script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`
    script.async = true
    document.head.appendChild(script)

    isReady = true
    trackPageView()
  }

  nuxtApp.hook('page:finish', trackPageView)

  onNuxtReady(() => {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(loadGoogleAnalytics, { timeout: 4000 })
    }
    else {
      window.setTimeout(loadGoogleAnalytics, 1500)
    }
  })
})
