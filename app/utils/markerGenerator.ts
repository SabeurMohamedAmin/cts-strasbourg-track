export type TransportType = 'bus' | 'tram'

/**
 * Generates an SVG string for a static stop map pin (upright teardrop pin)
 */
export const generateStopPinSvg = (color: string, type: TransportType, isSelected: boolean): string => {
  // Symmetrical teardrop pin path pointing down
  const pinPath = 'M20 2C10.6 2 3 9.6 3 19c0 10.3 14.3 22 16.1 23.4.5.4 1.3.4 1.8 0C22.7 41 37 29.3 37 19c0-9.4-7.6-17-17-17z'

  // High-quality transit paths scaled to fit inside the inner badge
  const iconPath = type === 'tram'
    ? 'M15 15c0 .7-.3 1.3-.8 1.8V18c0 .4-.4.8-.8.8h-.8c-.4 0-.8-.4-.8-.8v-.8H7.4v.8c0 .4-.4.8-.8.8h-.8c-.4 0-.8-.4-.8-.8v-1.2c-.5-.5-.8-1.1-.8-1.8V5c0-1.6 1.6-2.4 5.6-2.4s5.6.8 5.6 2.4v10zm-1.6-7.2H6.6V11h6.8V7.8zm-5 6.6c.7 0 1.2-.5 1.2-1.2s-.5-1.2-1.2-1.2-1.2.5-1.2 1.2.5 1.2 1.2 1.2zm4.8 0c.7 0 1.2-.5 1.2-1.2s-.5-1.2-1.2-1.2-1.2.5-1.2 1.2.5 1.2 1.2 1.2z'
    : 'M3.2 12.8c0 .7.3 1.3.8 1.8V16c0 .4.4.8.8.8h.8c.4 0 .8-.4.8-.8v-.8h6.4v.8c0 .4.4.8.8.8h.8c.4 0 .8-.4.8-.8v-1.4c.5-.5.8-1.1.8-1.8V4.8c0-2.8-2.9-3.2-6.4-3.2s-6.4.4-6.4 3.2v8zm1.6-8h9.6v3.2H4.8V4.8zm1.6 8c-.7 0-1.2-.5-1.2-1.2s.5-1.2 1.2-1.2 1.2.5 1.2 1.2-.5 1.2-1.2 1.2zm6.4 0c-.7 0-1.2-.5-1.2-1.2s.5-1.2 1.2-1.2 1.2.5 1.2 1.2-.5 1.2-1.2 1.2z'

  const strokeColor = isSelected ? '#FFFF00' : '#FFFFFF'
  const strokeWidth = isSelected ? '3.5' : '2'

  // Center the glyph on the white badge (circle center = 20, 19).
  // Each glyph path has a different bounding box, so each needs its own
  // offset: translate = badgeCenter - scale * glyphPathCenter.
  //   tram path center ≈ (9.8, 10.7)  → translate(9.2, 7.2)
  //   bus  path center ≈ (10.0, 9.2)  → translate(9.0, 8.9)
  const iconTransform = type === 'tram'
    ? 'translate(9.2, 7.2) scale(1.1)'
    : 'translate(9, 8.9) scale(1.1)'

  return `<svg xmlns="https://www.w3.org/2000/svg" width="44" height="48" viewBox="0 0 44 48">
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/>
    </filter>
    <g filter="url(#shadow)">
      <path d="${pinPath}" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
      <circle cx="20" cy="19" r="11" fill="#FFFFFF" />
      <path d="${iconPath}" fill="#111111" transform="${iconTransform}" />
    </g>
  </svg>`
}

/**
 * Generates an SVG string for a moving vehicle (circle with dynamic outer pointer chevron pointing North)
 */
export const generateVehicleMarkerSvg = (color: string, type: TransportType, isSelected: boolean): string => {
  // Arrow pointing upwards (North / 0 degrees)
  const pointerPath = 'M24 3 L18 11 L30 11 Z'

  const iconPath = type === 'tram'
    ? 'M15 15c0 .7-.3 1.3-.8 1.8V18c0 .4-.4.8-.8.8h-.8c-.4 0-.8-.4-.8-.8v-.8H7.4v.8c0 .4-.4.8-.8.8h-.8c-.4 0-.8-.4-.8-.8v-1.2c-.5-.5-.8-1.1-.8-1.8V5c0-1.6 1.6-2.4 5.6-2.4s5.6.8 5.6 2.4v10zm-1.6-7.2H6.6V11h6.8V7.8zm-5 6.6c.7 0 1.2-.5 1.2-1.2s-.5-1.2-1.2-1.2-1.2.5-1.2 1.2.5 1.2 1.2 1.2zm4.8 0c.7 0 1.2-.5 1.2-1.2s-.5-1.2-1.2-1.2-1.2.5-1.2 1.2.5 1.2 1.2 1.2z'
    : 'M3.2 12.8c0 .7.3 1.3.8 1.8V16c0 .4.4.8.8.8h.8c.4 0 .8-.4.8-.8v-.8h6.4v.8c0 .4.4.8.8.8h.8c.4 0 .8-.4.8-.8v-1.4c.5-.5.8-1.1.8-1.8V4.8c0-2.8-2.9-3.2-6.4-3.2s-6.4.4-6.4 3.2v8zm1.6-8h9.6v3.2H4.8V4.8zm1.6 8c-.7 0-1.2-.5-1.2-1.2s.5-1.2 1.2-1.2 1.2.5 1.2 1.2-.5 1.2-1.2 1.2zm6.4 0c-.7 0-1.2-.5-1.2-1.2s.5-1.2 1.2-1.2 1.2.5 1.2 1.2-.5 1.2-1.2 1.2z'

  const strokeColor = isSelected ? '#00FFFF' : '#FFFFFF'
  const strokeWidth = isSelected ? '4.5' : '2.5'

  return `<svg xmlns="https://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48">
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="1.5" stdDeviation="1.5" flood-opacity="0.35"/>
    </filter>
    <g filter="url(#shadow)">
      <path d="${pointerPath}" fill="${color}" />
      <circle cx="24" cy="24" r="14" fill="${color}" stroke="${strokeColor}" stroke-width="${strokeWidth}" />
      <circle cx="24" cy="24" r="10.5" fill="#FFFFFF" />
      <g transform="translate(14, 14)">
        <path d="${iconPath}" fill="#111111" transform="translate(1.2, 1.8) scale(1.05)" />
      </g>
    </g>
  </svg>`
}

/**
 * Converts an SVG string to a MapLibre-compatible ImageData object.
 *
 * Renders the SVG into an offscreen canvas via a Blob URL, then reads the
 * pixel data back as ImageData. The optional `pixelRatio` multiplier produces
 * a higher-resolution backing store for retina / HiDPI displays.
 *
 * @param svg        Raw SVG markup string
 * @param width      Logical width in CSS pixels (matches the SVG viewBox width)
 * @param height     Logical height in CSS pixels
 * @param pixelRatio Device pixel ratio multiplier (default 2 for retina)
 */
export function svgToImageData(
  svg: string,
  width: number,
  height: number,
  pixelRatio = 2,
): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svg], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const w = width * pixelRatio
      const h = height * pixelRatio
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.scale(pixelRatio, pixelRatio)
      ctx.drawImage(img, 0, 0, width, height)
      resolve(ctx.getImageData(0, 0, w, h))
    }
    img.onerror = reject
    img.src = url
  })
}
