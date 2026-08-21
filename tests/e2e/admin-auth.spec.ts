import { test, expect } from '@playwright/test'

/**
 * Phase 1 — admin authentication happy path.
 *
 * Needs NUXT_ADMIN_PASSWORD (and NUXT_SESSION_PASSWORD) in the environment
 * of the dev server AND of this test process. Skipped otherwise, so the
 * public e2e suites keep running on machines without admin credentials.
 */

const adminPassword = process.env.NUXT_ADMIN_PASSWORD

test.describe('admin authentication', () => {
  test.skip(!adminPassword, 'NUXT_ADMIN_PASSWORD must be set to run this suite')

  test('anonymous visitor is redirected to the login page', async ({ page }) => {
    await page.goto('/admin')

    await expect(page).toHaveURL(/\/admin\/login/)
    await expect(page.getByLabel('Mot de passe')).toBeVisible()
  })

  test('wrong password shows an error and stays on the login page', async ({ page }) => {
    await page.goto('/admin/login')

    await page.getByLabel('Mot de passe').fill('definitely-not-the-password')
    await page.getByRole('button', { name: 'Se connecter' }).click()

    await expect(page.getByText('Mot de passe incorrect.')).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/login/)
  })

  test('login → dashboard → logout', async ({ page }) => {
    await page.goto('/admin/login')

    await page.getByLabel('Mot de passe').fill(adminPassword!)
    await page.getByRole('button', { name: 'Se connecter' }).click()

    // Landed on the dashboard.
    await expect(page).toHaveURL(/\/admin$/)
    await expect(page.getByText('Tableau de bord')).toBeVisible()

    // Logout returns to the login page…
    await page.getByRole('button', { name: 'Se déconnecter' }).click()
    await expect(page).toHaveURL(/\/admin\/login/)

    // …and the session is really gone: /admin bounces back to login.
    await page.goto('/admin')
    await expect(page).toHaveURL(/\/admin\/login/)
  })
})
