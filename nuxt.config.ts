import vuetify, { transformAssetUrls } from 'vite-plugin-vuetify'

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  /**
   * Single `app` block on purpose.
   * This key was previously declared TWICE in this file — in a JS object
   * literal the second declaration silently replaces the first, so
   * baseURL and the favicon.ico link were being dropped.
   */
  app: {
    baseURL: '/',
    head: {
      // Match the PWA manifest (lang: 'fr') and the French-only UI.
      htmlAttrs: { lang: 'fr' },
      title: 'Strasbourg Bus-Trams Live',
      meta: [
        { name: 'description', content: 'Bus et tramways de Strasbourg en temps réel sur une carte interactive.' },
        { name: 'theme-color', content: '#c8102e' },
      ],
      link: [
        { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' },
        { rel: 'icon', href: '/pixel.jpg', type: 'image/jpg' },
      ],
      // Google AdSense is intentionally NOT loaded here: a script in <head>
      // delayed the mobile first paint. It is injected after first paint
      // by app/plugins/adsense.client.ts instead.
      script: process.env.NODE_ENV === 'production' ? [
        {
          src: 'https://analytics.ahrefs.com/analytics.js',
          'data-key': '1cboUd/wpUXcRyMhEeoVDQ',
          async: true,
        },
      ] : [],
    },
  },

  // Global CSS: forces html/body/v-application to fill the viewport with no scrollbars.
  css: ['~/assets/global.css'],

  modules: [
    '@nuxt/eslint',
    '@pinia/nuxt',
    '@vite-pwa/nuxt',
    // Sealed session cookies + useUserSession() for the /admin area.
    // Requires NUXT_SESSION_PASSWORD (32+ chars) in the environment.
    'nuxt-auth-utils',
    // Tree-shaking: auto-imports only the Vuetify components/directives
    // actually used in templates. Theme config lives in app/plugins/vuetify.ts.
    (_options, nuxt) => {
      nuxt.hooks.hook('vite:extendConfig', (config) => {
        // @ts-expect-error vite plugin type mismatch between nuxt and vite-plugin-vuetify
        config.plugins?.push(vuetify({ autoImport: true }))
      })
    },
  ],

  build: { transpile: ['vuetify'] },

  /**
   * The private admin area must never appear in search results:
   * every /admin page and /api/admin endpoint answers with a noindex
   * header. robots.txt also disallows /admin (see server/routes).
   */
  routeRules: {
    '/admin/**': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
    '/api/admin/**': { headers: { 'X-Robots-Tag': 'noindex, nofollow' } },
  },

  vite: {
    vue: { template: { transformAssetUrls } },
    optimizeDeps: {
      // Pre-bundle deps that Vite would otherwise discover at runtime,
      // which triggers full page reloads during development.
      include: [
        '@vueuse/core', // AppDrawer.vue
        'maplibre-gl', // CJS
        'zod', // shared/schemas
      ],
    },
  },

  /**
   * runtimeConfig keys map 1-to-1 with NUXT_ env vars.
   * NUXT_DATABASE_URL              → runtimeConfig.databaseUrl
   * NUXT_CTS_API_TOKEN             → runtimeConfig.ctsApiToken
   * NUXT_PUBLIC_MAP_STYLE_URL      → runtimeConfig.public.mapStyleUrl
   * NUXT_PUBLIC_MAP_STYLE_DARK_URL → runtimeConfig.public.mapStyleDarkUrl
   *
   * The public style URLs MUST have non-empty defaults here so the map
   * renders even without a .env file. Override via env vars in production.
   */
  runtimeConfig: {
    // Private — server-side only
    databaseUrl: '',
    // Admin panel v1: a single admin. NUXT_ADMIN_USERNAME and
    // NUXT_ADMIN_PASSWORD are the BOOTSTRAP credentials: the first
    // successful login writes them (hashed) into admin_credentials, and
    // every later login checks the database row instead.
    // The session cookie itself is sealed by nuxt-auth-utils with
    // NUXT_SESSION_PASSWORD (32+ characters, required by the module).
    adminUsername: 'admin',
    adminPassword: '',
    // Password-reset emails are sent through Resend (https://resend.com).
    // mailFrom must be a sender verified in your Resend account,
    // e.g. "Admin <admin@votredomaine.fr>".
    resendApiKey: '',
    mailFrom: '',
    // Cloudinary — image hosting for the blog. Uploads are signed
    // server-side by POST /api/admin/media/upload; the secret never
    // reaches the browser.
    cloudinaryCloudName: '',
    cloudinaryApiKey: '',
    cloudinaryApiSecret: '',
    // Media-library folder that receives every upload.
    cloudinaryFolder: 'blog',
    ctsApiToken: '',
    ctsApiBaseUrl: 'https://api.cts-strasbourg.eu',
    // Lightweight shared secret identifying the mobile app (ROADMAP_NITRO_API
    // 3.3). When set, non-browser /api/v1/* requests must send it as the
    // X-App-Token header. Empty = the check is disabled (local dev).
    // NUXT_APP_TOKEN — server-side only, never exposed to clients.
    appToken: '',
    pollIntervalMs: 12000,
    // EstimatedTimetable can be a large response. Keep this longer than the
    // normal polling cadence; the poller skips ticks while a fetch is active.
    ctsRequestTimeoutMs: 30000,

    // Public — exposed to the browser
    public: {
      // Canonical site origin (e.g. https://www.mysite.com) used by
      // robots.txt, sitemap.xml and canonical tags. When empty, the
      // request origin is used. Override with NUXT_PUBLIC_SITE_URL.
      siteUrl: '',
      // Loaded after hydration during browser idle time so analytics does not
      // compete with critical resources. Override or disable with the env var.
      googleAnalyticsId: 'G-J88FTLBT6Z',
      // Light mode base map (OpenFreeMap Liberty)
      mapStyleUrl: 'https://tiles.openfreemap.org/styles/liberty',
      // Dark mode base map (OpenFreeMap Fiord)
      // Swapped in by MapView when the user toggles dark mode.
      mapStyleDarkUrl: 'https://tiles.openfreemap.org/styles/fiord',
      mapCenter: [7.7446, 48.5841] as [number, number],
      mapZoom: 11,
    },
  },

  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Strasbourg Bus-Trams Live',
      short_name: 'Bus-Trams',
      lang: 'fr',
      theme_color: '#c8102e',
      background_color: '#ffffff',
      display: 'standalone',
      icons: [
        { src: '/pixel.jpg', sizes: 'any', type: 'image/jpg', purpose: 'any' },
        { src: '/pixel.jpg', sizes: 'any', type: 'image/jpg', purpose: 'maskable' },
      ],
    },
  },
})
