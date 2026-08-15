import { describe, expect, it } from 'vitest'
import {
  EUROMETROPOLE_BOUNDS_DESKTOP,
  EUROMETROPOLE_BOUNDS_MOBILE,
  boundsForBreakpoint,
} from '~/utils/map-constants'

/**
 * Unit tests for the bounds-selection logic used by useMapFraming (Step 2.2).
 * The selection is a pure function, so no Vuetify or MapLibre is needed.
 */
describe('boundsForBreakpoint', () => {
  it('returns the mobile frame on md-and-down breakpoints', () => {
    expect(boundsForBreakpoint(true)).toBe(EUROMETROPOLE_BOUNDS_MOBILE)
  })

  it('returns the desktop frame on larger breakpoints', () => {
    expect(boundsForBreakpoint(false)).toBe(EUROMETROPOLE_BOUNDS_DESKTOP)
  })

  it('keeps the mobile frame horizontally inside the desktop frame', () => {
    const [[mobileWest], [mobileEast]] = EUROMETROPOLE_BOUNDS_MOBILE
    const [[desktopWest], [desktopEast]] = EUROMETROPOLE_BOUNDS_DESKTOP
    expect(mobileWest).toBeGreaterThan(desktopWest)
    expect(mobileEast).toBeLessThan(desktopEast)
  })
})
