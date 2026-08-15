import { test, expect } from '@playwright/test'

/**
 * Phase 8 — the full admin blog journey, end to end:
 * login → create category → create draft article → preview → publish
 * → verify on /blog/[slug] → delete it (article, then category).
 *
 * Needs NUXT_ADMIN_PASSWORD (and NUXT_SESSION_PASSWORD) in the
 * environment of the dev server AND of this test process. Skipped
 * otherwise, like the auth suite.
 */

const adminPassword = process.env.NUXT_ADMIN_PASSWORD

// Unique slugs per run so the suite can repeat against the same database.
const stamp = Date.now()
const categoryName = `Catégorie e2e ${stamp}`
const articleTitle = `Article e2e ${stamp}`
const articleSlug = `article-e2e-${stamp}`

test.describe('admin blog CRUD', () => {
  test.skip(!adminPassword, 'NUXT_ADMIN_PASSWORD must be set to run this suite')

  test('login → category → draft → preview → publish → public page → delete', async ({ page }) => {
    // ── Login ─────────────────────────────────────────────────────────────────
    await page.goto('/admin/login')
    await page.getByLabel('Mot de passe').fill(adminPassword!)
    await page.getByRole('button', { name: 'Se connecter' }).click()
    await expect(page).toHaveURL(/\/admin$/)

    // ── Create the category ──────────────────────────────────────────────────────
    await page.goto('/admin/categories')
    await page.getByRole('button', { name: 'Nouvelle catégorie' }).click()
    await page.getByLabel('Nom (fr)').fill(categoryName)
    // The slug auto-generates from the name — no need to touch it.
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByText('Catégorie créée.')).toBeVisible()

    // ── Create the draft article ────────────────────────────────────────────────
    await page.goto('/admin/articles/new')
    await page.getByLabel('Titre (fr)').fill(articleTitle)
    await page.getByLabel('Catégorie').click()
    await page.getByRole('option', { name: categoryName }).click()
    await page.getByLabel('Extrait').fill('Un extrait écrit par le test de bout en bout.')
    await page.getByLabel('Arrêt le plus proche').fill('Homme de Fer')
    await page.getByLabel('Image principale (URL)').fill(`https://picsum.photos/seed/e2e-${stamp}/800/450`)
    await page.getByLabel('Titre de l’outro').fill('Pour finir')
    await page.getByLabel('Texte de l’outro').fill('Texte de conclusion écrit par le test.')

    await page.getByRole('button', { name: 'Enregistrer en brouillon' }).first().click()
    // The editor leaves /new for the real URL of the saved draft.
    await expect(page).toHaveURL(new RegExp(`/admin/articles/${articleSlug}$`))

    // ── Preview the draft (new tab, admin-only) ─────────────────────────────
    const [previewPage] = await Promise.all([
      page.context().waitForEvent('page'),
      page.getByRole('button', { name: 'Aperçu' }).click(),
    ])
    await previewPage.waitForLoadState()
    await expect(previewPage.getByRole('heading', { name: articleTitle })).toBeVisible()
    await expect(previewPage.getByText('Aperçu administrateur')).toBeVisible()
    await previewPage.close()

    // ── Publish ───────────────────────────────────────────────────────────────
    await page.getByRole('button', { name: 'Publier', exact: true }).first().click()
    await expect(page.getByText('Article publié.')).toBeVisible()

    // ── Verify on the public site ───────────────────────────────────────────────
    await page.goto(`/blog/${articleSlug}`)
    await expect(page.getByRole('heading', { name: articleTitle })).toBeVisible()

    // ── Delete the article ────────────────────────────────────────────────────────
    await page.goto('/admin/articles')
    await page.getByLabel('Rechercher un titre…').fill(articleTitle)
    await page.getByRole('button', { name: `Supprimer ${articleTitle}` }).click()
    await page.getByRole('button', { name: 'Supprimer l’article' }).click()
    await expect(page.getByText('Article supprimé.')).toBeVisible()

    // The public URL is gone for good.
    const response = await page.goto(`/blog/${articleSlug}`)
    expect(response?.status()).toBe(404)

    // ── Cleanup: delete the now-empty category ──────────────────────────────
    await page.goto('/admin/categories')
    await page.getByRole('button', { name: `Supprimer ${categoryName}` }).click()
    await page.getByRole('button', { name: 'Supprimer la catégorie' }).click()
    await expect(page.getByText('Catégorie supprimée.')).toBeVisible()
  })
})
