# Roadmap — Admin Panel (Blog first) · v2

Goal: a private `/admin` area to manage the blog without touching the database
by hand — full CRUD for **articles** and **categories** — built with the stack
already in the repo (Nuxt 4, Vuetify 4, Nitro, Drizzle + Postgres, Zod,
nuxt-auth-utils).

Guiding principles:
- Reuse existing patterns: Zod schemas in `shared/`, API handlers in
  `server/api/`, dumb components + orchestrator pages, glass design tokens.
- Junior-friendly: small phases, each one shippable and testable on its own.
- The public site must never break: the admin is additive, behind auth,
  and excluded from SEO.
- **i18n-ready from day one**: every human-readable field lives in a
  translation table. Ship `fr` only; adding a language later = inserting rows,
  zero migrations.
- **Slugs, never ids, in URLs**: every dynamic route and API path uses
  `[slug]`. Numeric ids exist only as DB primary/foreign keys.
- **SEO is the product**: articles exist to rank. Meta fields, sitemap
  hygiene, and structured data are requirements, not polish.

---

## Phase 0 — Decisions & scaffolding (½ day)

- [x] Route namespace: everything lives under `/admin` (pages) and
      `/api/admin/**` (endpoints).
- [x] Auth strategy for v1: **nuxt-auth-utils with a single admin**.
      Password from env (`NUXT_ADMIN_PASSWORD`), session sealed by
      `NUXT_SESSION_PASSWORD` (32+ chars, required by the module).
      No users table yet — upgrade path to multiple admins is additive.
- [x] Install `nuxt-auth-utils`, add both env vars to `.env.example` and
      `runtimeConfig` (private keys) in `nuxt.config.ts`.
- [x] Locale decision: default locale is `fr`, stored as a `locale` column
      (varchar) in translation tables. A `SUPPORTED_LOCALES = ['fr'] as const`
      constant lives in `shared/types/locale.ts` — extending it later is one
      line.
- [x] SEO: send `X-Robots-Tag: noindex` for `/admin/**` (route rules) and
      exclude `/admin` from `sitemap.xml` / `robots.txt`.

## Phase 1 — Authentication with nuxt-auth-utils (1 day)

- [x] `POST /api/admin/login` — constant-time compare of the password against
      `NUXT_ADMIN_PASSWORD`, then
      `setUserSession(event, { user: { role: 'admin' } })`.
      Rate-limit: 5 attempts / 15 min per IP.
- [x] `POST /api/admin/logout` — `clearUserSession(event)`.
- [x] `server/utils/require-admin.ts` — thin wrapper around
      `requireUserSession(event)` that also checks `role === 'admin'`
      (throws 401). Used by every admin endpoint.
- [x] `app/middleware/admin.ts` — route middleware using `useUserSession()`:
      redirect anonymous visitors from `/admin/**` to `/admin/login`.
- [x] `app/pages/admin/login.vue` — minimal Vuetify card: password field,
      error state, loading state. (Plus a placeholder `/admin` dashboard so
      the auth loop is testable end to end — replaced in Phase 4.)
- [x] Tests: unit for the guard (+ rate limit), e2e happy path
      (login → dashboard → logout, skipped when `NUXT_ADMIN_PASSWORD`
      is not set).

> Why nuxt-auth-utils and not hand-rolled cookies: sealed sessions,
> `useUserSession()` composable, and SSR-safe session reads come for free —
> less code, fewer mistakes, and the future "multiple admins" upgrade is just
> adding a users table + `verifyPassword()`.

## Phase 2 — Database: i18n-ready schema (1–1½ days)

Today `blogArticles.category` is a free string, the category list is hardcoded
in `shared/types/blog` (`BLOG_CATEGORIES`), and titles/excerpts sit directly
on the article row. Restructure once, correctly:

**Rule: anything a human reads → translation table. Anything a machine reads
(slugs, dates, status, URLs, positions) → parent row.**

- [x] `blog_categories`: `id`, `slug` (unique), `icon` (mdi name), `position`,
      `createdAt`.
- [x] `blog_category_translations`: `categoryId` (FK, cascade), `locale`,
      `name`, unique on `(categoryId, locale)`.
- [x] `blog_articles`: `id`, `slug` (unique), `categoryId` (FK), `status`
      (`draft` | `published`, default `draft`), `publishedAt`,
      `readingMinutes`, `heroImageUrl`, `createdAt`, `updatedAt`.
- [x] `blog_article_translations`: `articleId` (FK, cascade), `locale`,
      `title`, `excerpt`, `seoTitle`, `seoDescription`, `outroTitle`,
      `outroText`, unique on `(articleId, locale)`.
- [x] `blog_article_sections`: `id`, `articleId` (FK, cascade), `locale`,
      `position`, `title`, `body`.
- [x] `blog_article_media`: `id`, `articleId` (FK, cascade), `position`,
      `type` (`image` | `youtube`), `src` (URL), `alt`.
- [x] Migration script: create tables, backfill existing articles/categories
      as `fr` translation rows, backfill `categoryId` from the old string,
      then drop the old string/title columns.
      (`pnpm db:generate` → review SQL → `pnpm db:migrate`.)
- [x] Update `shared/types/blog.ts`: categories become data-driven; delete
      the `BLOG_CATEGORIES` hardcode.
- [x] Public API: `GET /api/blog?locale=fr` (locale defaults to `fr`) joins
      translations and returns `published` only. `GET /api/blog/[slug]` for a
      single article — by slug, never id.
- [x] Update `scripts/seed-blog.ts` to write parent + translation rows using
      category slugs.
- [x] Icon note: any new category icon must be added to
      `app/utils/mdi-icons.ts` (see the comment in that file).

## Phase 3 — Admin API: CRUD endpoints, slug-addressed (1–2 days)

All handlers call `requireAdmin(event)` first and validate bodies with Zod
schemas in `shared/schemas/admin-blog.ts` (reused by the client forms).
Payloads carry a `translations` array keyed by locale — the admin UI only
fills `fr` in v1, but the API is already multilingual.

**Media validation (Zod)**: `src` must be a valid URL from an allowlisted
host — your cloud bucket domain, `youtube.com`, `youtu.be`. Bad links can't
be saved. `type: 'youtube'` additionally requires a parseable video id.

Categories:
- [x] `GET    /api/admin/categories` — list (with article counts, translated
      names).
- [x] `POST   /api/admin/categories` — create (slug auto-generated from the
      `fr` name, editable before save).
- [x] `PATCH  /api/admin/categories/[slug]` — rename / re-icon / reorder.
- [x] `DELETE /api/admin/categories/[slug]` — refuse (409) while articles
      still use it, or require a `reassignTo` category slug.

Articles:
- [x] `GET    /api/admin/articles` — paginated list: title, category, status,
      publishedAt, readingMinutes. Filters: search, category slug, status.
- [x] `GET    /api/admin/articles/[slug]` — full article incl. translations,
      sections, gallery.
- [x] `POST   /api/admin/articles` — create (translations + sections +
      gallery in one payload, wrapped in a transaction like the seed script).
- [x] `PATCH  /api/admin/articles/[slug]` — update (replace
      translation/section/media rows; ON DELETE CASCADE handles cleanup).
- [x] `DELETE /api/admin/articles/[slug]`.
- [x] **Slug policy**: auto-generated from the title, editable while draft,
      locked once published (a published slug is a public URL — changing it
      breaks SEO; redirects are a "Later" item).
- [x] Tests: one vitest file per resource (validation errors, 401, slug
      conflicts 409, media allowlist rejection, happy path).

## Phase 4 — Admin UI shell (1 day)

- [x] `app/layouts/admin.vue` — own chrome (no public bottom nav): left
      `v-navigation-drawer` (Dashboard, Articles, Catégories, → Voir le site),
      top bar with logout button (calls `clearUserSession` client helper).
      Reuse the glass design tokens; Vuetify core components only.
- [x] `app/pages/admin/index.vue` — dashboard: counters (articles, drafts,
      categories) + "last edited" list linking to `/admin/articles/[slug]`.
      Cheap queries only.
- [x] Shared UI atoms in `app/components/admin/`: `AdminPageHeader.vue`,
      `AdminConfirmDialog.vue` (modeled on FavoriteGroupDeleteDialog),
      `AdminSnackbar.vue` (success/error feedback).

## Phase 5 — Categories CRUD UI (1 day)

- [x] `app/pages/admin/categories.vue`:
      - `v-data-table` (name, icon preview, article count, position).
      - Create/edit in a `v-dialog` form: name (fr), slug (auto, editable
        pre-save), icon picker (list fed by `mdiIconPaths` keys), position.
      - Delete via AdminConfirmDialog; blocked state explains the 409 and
        offers "reassign articles to…" select.
- [x] Optimistic refresh with `useFetch` + `refresh()` after each mutation.

## Phase 6 — Articles CRUD UI (2–3 days) — the core

- [x] `app/pages/admin/articles/index.vue` — list: search, category filter,
      status chip (draft/published), sort by date. Row actions: edit,
      duplicate (new draft, `-copie` slug suffix), delete.
- [x] `app/pages/admin/articles/[slug].vue` — editor. Creation uses the
      reserved path `/admin/articles/new` (guard: `new` is a forbidden slug
      value).
      - **Méta**: title → slug auto-generated (editable while draft,
        read-only chip once published), excerpt with counter, category
        select, reading minutes, hero image URL with preview,
        publishedAt date.
      - **SEO**: `seoTitle` + `seoDescription` fields with character counters
        (≤60 / ≤160) and a Google-style snippet preview.
      - **Sections**: repeatable rows (title + textarea), add / remove /
        reorder (up/down buttons — no drag lib needed for v1).
      - **Galerie**: repeatable media rows (type image|youtube, src, alt),
        thumbnail preview (YouTube thumb derived from video id), reorder.
        Client-side allowlist validation mirrors the API.
      - **Outro**: title + text.
      - Actions: "Enregistrer en brouillon" / "Publier" / "Aperçu" (opens
        `/blog/[slug]?preview=1`, which allows drafts for admins only —
        checked via `useUserSession()` server-side).
      - Client-side validation with the same Zod schema as the API.
      - All fields write into the `fr` translation object — a locale tab
        switcher is a later drop-in, the form component already receives
        `{ locale, fields }`.
- [x] Unsaved-changes guard (`onBeforeRouteLeave` + confirm dialog).

## Phase 7 — SEO & public site wiring (½–1 day)

- [x] Public `/blog/[slug]` page reads the new API shape: translated
      title/excerpt/sections, `seoTitle`/`seoDescription` via `useSeoMeta`.
- [x] JSON-LD `Article` structured data (headline, datePublished, image) on
      article pages.
- [x] Sitemap includes only published articles by slug; drafts never leak.
- [x] `hreflang` groundwork: emit `fr` self-referencing tags now so adding
      locales later is mechanical.

## Phase 8 — Polish & safety (1 day)

- [x] Accessibility pass: focus rings, aria-labels, keyboard-only
      run-through.
- [x] Error handling: every mutation shows a snackbar, no silent failures.
- [x] e2e: login → create category → create draft article → preview →
      publish → verify on `/blog/[slug]` → delete it.
- [x] Confirm `/admin` chunks stay out of the public entry bundle (verify
      with `nuxt build --analyze` locally; **no pipeline**).
      Verified by static import audit: `pages/admin/**` are route-split
      async chunks, `layouts/admin.vue` is loaded async by `NuxtLayout`,
      `middleware/admin.ts` is *named* (lazy) not global, and no admin
      code is referenced from plugins, stores, composables, or
      `layouts/default.vue`. Re-check after refactors with
      `nuxt build --analyze` locally.

## Phase 9 — Password reset by email (1 day)

Single admin account moves from env-only to the database, unlocking
"forgot password" by email. Reset links are sent ONLY to the two
allowlisted addresses in `shared/types/admin-auth.ts`, are single-use,
and expire after **24 hours**. Mail provider: **Resend**.

- [x] DB: `admin_credentials` (single row: username, scrypt
      `passwordHash` via nuxt-auth-utils, `updatedAt`) and
      `admin_password_resets` (SHA-256 `tokenHash` — never the raw
      token — `email`, `expiresAt` 24h, `usedAt`).
      Bootstrap: the first successful env-vars login persists the
      account row; no separate seed script needed.
      Migration generated and committed
      (`server/database/migrations/0004_cultured_logan.sql`) —
      apply it locally with `pnpm db:migrate`.
- [x] Config: `ADMIN_RESET_EMAILS` allowlist (server-side only),
      `NUXT_ADMIN_USERNAME`, `NUXT_RESEND_API_KEY`, `NUXT_MAIL_FROM`
      in runtimeConfig + `.env.example`.
- [x] `POST /api/admin/password/forgot` — always the same generic 200
      (anti-enumeration), 3 requests / 15 min per IP, emails
      `/admin/reset-password?token=…` via Resend.
- [x] `POST /api/admin/password/reset` — token unused + unexpired,
      new hash written in a transaction, token marked used, session
      cleared. Login checks the DB row (env vars = bootstrap fallback).
- [x] UI: username field + « Mot de passe oublié ? » on `/admin/login`,
      `/admin/forgot-password`, `/admin/reset-password` (glass tokens,
      noindex via the existing `/admin/**` route rule).
- [x] Mailer: `server/utils/mailer.ts` — Resend HTTP API, French
      plain-text + minimal HTML, 24h validity note.
- [x] Tests: token generation/hash/expiry, single-use rule, forgot
      rate limit, email + password Zod rules.

## Phase 10 — Media: Cloudinary images & Vimeo videos (1 day)

Images move from “paste an allowlisted URL” to real hosting on
**Cloudinary**; videos gain **Vimeo** next to YouTube. The API secret
never reaches the browser: the editor talks only to our own endpoint,
which signs the upload server-side.

- [x] `POST /api/admin/media/upload` — signed Cloudinary upload; accepts
      a multipart file (images only, 10 MB max) OR a JSON `{ url }` that
      Cloudinary fetches itself (remote import). Returns the https
      `res.cloudinary.com` delivery URL.
- [x] Config: `NUXT_CLOUDINARY_CLOUD_NAME`, `NUXT_CLOUDINARY_API_KEY`,
      `NUXT_CLOUDINARY_API_SECRET`, `NUXT_CLOUDINARY_FOLDER` in
      runtimeConfig (private) + `.env.example`.
- [x] Allowlist: `res.cloudinary.com` joins `ALLOWED_IMAGE_HOSTS`
      (picsum stays for the seeds).
- [x] Schema: media type `vimeo` with `parseVimeoId()` (id or any usual
      URL shape), `normalizeMediaSrc()` stores the bare video id — same
      rule as YouTube.
- [x] Editor UI: hero image + gallery image rows get “envoyer un
      fichier” and “importer l’URL vers Cloudinary” buttons; Vimeo
      option in the gallery type select with validation + thumbnail
      (vumbnail.com).
- [x] Public gallery: BlogMediaSlider embeds `player.vimeo.com`
      (`dnt=1`, like the youtube-nocookie embed) with play badge on all
      video thumbnails.

## Phase 11 — Disruptions banner CRUD (promoted from « Later »)

Promoted because the disruptions feed now serves BOTH clients' banners
(web + Flutter) and the push pipeline — see ROADMAP_NITRO_API Steps 8.2–8.4.

- [ ] `disruptions` table + admin CRUD using the same admin shell pattern
      (list + dialog form, Zod schemas in `shared/`, `requireAdmin`).
- [ ] Public read endpoint `GET /api/v1/disruptions` joins the frozen
      `/api/v1` contract (consumed by the web banner, Flutter 5.7, and the
      push sender).
- [ ] Note: the public blog API also joins the frozen `/api/v1` contract —
      slug + locale params can never break (mobile depends on them).

## Later (out of scope for v1)

- Second language live: add `'en'` to `SUPPORTED_LOCALES`, locale tabs in the
  editor, localized slugs + 301 redirects, per-locale sitemaps.
- Multiple admin users + roles (users table on top of nuxt-auth-utils,
  `verifyPassword()`).
- Rich text / markdown sections instead of plain textareas.
- Slug rename after publish (requires a redirects table).
- Audit log of admin actions.
- Manage other content types (landmarks) with the same admin shell.
  (Perturbation/disruptions banners: promoted to Phase 11.)

---

### Suggested order of merges (each phase = one small MR-sized commit set)

1. Phase 0 + 1 (nuxt-auth-utils) — nothing visible publicly.
2. Phase 2 (i18n schema + migration) — includes public API update, test
   carefully, **this is the riskiest MR**.
3. Phase 3 (admin API) — backend only.
4. Phase 4 + 5 (shell + categories UI) — first usable screen.
5. Phase 6 (articles editor).
6. Phase 7 (SEO wiring) + Phase 8 (polish).
