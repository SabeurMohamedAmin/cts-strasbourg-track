/**
 * Loads Google AdSense AFTER first paint (client only).
 *
 * The script used to be declared in nuxt.config.ts `app.head`, where it
 * competed with the app's own critical requests and delayed the mobile LCP.
 * Injecting it once the app is mounted — and only when the browser is idle —
 * keeps ads working while removing them from the critical rendering path.
 */
const ADSENSE_SRC
  = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-5369228147932673'

export default defineNuxtPlugin(() => {
  // onNuxtReady = the app has mounted and hydration is done (first paint).
  onNuxtReady(() => {
    function injectAdSense() {
      // Guard: never inject the script twice (e.g. after HMR in dev).
      if (document.querySelector(`script[src="${ADSENSE_SRC}"]`)) return

      const script = document.createElement('script')
      script.src = ADSENSE_SRC
      script.async = true
      script.crossOrigin = 'anonymous'
      document.head.appendChild(script)
    }

    // Wait for an idle moment; fall back to a small delay on browsers
    // without requestIdleCallback (Safari).
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(injectAdSense, { timeout: 5000 })
    }
    else {
      window.setTimeout(injectAdSense, 2000)
    }
  })
})
