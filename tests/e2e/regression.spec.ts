import { test, expect } from '@playwright/test'

/**
 * Phase 5 — regression suite.
 *
 * Complements the Phase 0 smoke test with the behaviours refactored in
 * Phases 2–4:
 *   1. theme toggle (useAppTheme — SSR-safe cookie),
 *   2. line filter panel (LineFilterChips + lines store),
 *   3. stop selection → arrivals sheet (search → StopSheet).
 */

test.describe('theme toggle', () => {
  test('switches to dark mode and persists across reload', async ({ page }) => {
    await page.goto('/')

    // The theme starts light (cookie default) — the toggle lives in the drawer footer.
    await page.getByRole('button', { name: 'Menu' }).click()
    const drawer = page.locator('.v-navigation-drawer')
    await expect(drawer).toBeVisible()

    await drawer.getByText('Mode sombre').click()
    await expect(page.locator('.v-application')).toHaveClass(/v-theme--dark/)

    // The cookie makes the choice survive a full reload (SSR renders dark).
    await page.reload()
    await expect(page.locator('.v-application')).toHaveClass(/v-theme--dark/, { timeout: 15_000 })
  })
})

test.describe('line filter', () => {
  test('opens the panel and toggles a line chip', async ({ page }) => {
    await page.goto('/')

    // Collapsed pill → expanded panel.
    await page.getByRole('button', { name: 'Filtres lignes' }).click()
    const panel = page.getByRole('group', { name: 'Filtres par ligne' })
    await expect(panel).toBeVisible()

    // Line chips render once the /api/routes call resolves.
    const firstChip = panel.locator('.lfp-chip').first()
    await expect(firstChip).toBeVisible({ timeout: 15_000 })

    // Toggling flips the pressed state both ways.
    const initialPressed = await firstChip.getAttribute('aria-pressed')
    await firstChip.click()
    await expect(firstChip).toHaveAttribute(
      'aria-pressed',
      initialPressed === 'true' ? 'false' : 'true',
    )
    await firstChip.click()
    await expect(firstChip).toHaveAttribute('aria-pressed', initialPressed ?? 'false')
  })
})

test.describe('stop selection', () => {
  test('opens the arrivals sheet from a search result', async ({ page }) => {
    await page.goto('/')

    await page.getByRole('button', { name: 'Menu' }).click()
    const drawer = page.locator('.v-navigation-drawer')
    await drawer.getByPlaceholder('Rechercher un arrêt…').fill('gare')

    const firstResult = drawer.locator('.v-list-item', { hasText: /gare/i }).first()
    await expect(firstResult).toBeVisible({ timeout: 15_000 })
    await firstResult.click()

    // The StopSheet arrivals section proves the whole chain works:
    // search → stops store → map focus → arrivals fetch → sheet.
    await expect(page.getByText('Prochains passages')).toBeVisible({ timeout: 15_000 })
  })
})
