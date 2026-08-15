import { test, expect } from '@playwright/test'

/**
 * Phase 0 — Step 0.1 smoke test.
 *
 * Freezes the current behaviour BEFORE any refactoring starts:
 *   1. the app loads,
 *   2. the map canvas appears,
 *   3. the drawer opens,
 *   4. a stop can be selected (its arrivals sheet shows up).
 *
 * Every refactoring step must keep this suite green.
 */

test.describe('smoke', () => {
  test('app loads and the map canvas appears', async ({ page }) => {
    await page.goto('/')

    await expect(page).toHaveTitle(/CTS Tracker Strasbourg/)

    // MapLibre injects a <canvas class="maplibregl-canvas"> once the map
    // is created. Tiles can take a while on cold start, hence the timeout.
    await expect(page.locator('.maplibregl-canvas')).toBeVisible({ timeout: 20_000 })
  })

  test('drawer opens from the hamburger FAB', async ({ page }) => {
    await page.goto('/')

    // The floating hamburger button has aria-label="Menu" (index.vue).
    await page.getByRole('button', { name: 'Menu' }).click()

    const drawer = page.locator('.v-navigation-drawer')
    await expect(drawer).toBeVisible()

    // The stop search field is the drawer's main affordance.
    await expect(drawer.getByPlaceholder('Rechercher un arrêt…')).toBeVisible()
  })

  test('a stop can be selected from search', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Menu' }).click()

    const drawer = page.locator('.v-navigation-drawer')
    await drawer.getByPlaceholder('Rechercher un arrêt…').fill('gare')

    // Results render as v-list-items whose title contains the query.
    // Filtering by text skips the drawer header item ("CTS Strasbourg").
    const firstResult = drawer.locator('.v-list-item', { hasText: /gare/i }).first()
    await expect(firstResult).toBeVisible({ timeout: 15_000 })
    await firstResult.click()

    // The StopSheet's arrivals section proves the stop was selected.
    await expect(page.getByText('Prochains passages')).toBeVisible({ timeout: 15_000 })
  })
})
