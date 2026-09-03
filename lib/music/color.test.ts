import { describe, expect, it } from 'vitest'
import { dominantColor, pillTint, textOn, toCss } from './color'

/** Builds RGBA pixel data from [r,g,b,a] tuples, the shape getImageData returns. */
function pixels(...rgba: [number, number, number, number][]): Uint8ClampedArray {
  return new Uint8ClampedArray(rgba.flat())
}

/** `count` copies of one pixel — for building a clear majority. */
function repeat(rgba: [number, number, number, number], count: number) {
  return Array.from({ length: count }, () => rgba) as [number, number, number, number][]
}

describe('dominantColor', () => {
  it('returns the only colour present', () => {
    expect(dominantColor(pixels(...repeat([200, 40, 40, 255], 10)))).toEqual({
      r: 200,
      g: 40,
      b: 40,
    })
  })

  it('returns the most common colour, not the average', () => {
    // Averaging these would give a muddy blend that matches neither.
    const data = pixels(...repeat([200, 40, 40, 255], 20), ...repeat([40, 40, 200, 255], 5))
    const result = dominantColor(data)
    expect(result!.r).toBeGreaterThan(result!.b)
  })

  // hqdefault.jpg letterboxes 16:9 video into a 4:3 frame, so black bars are
  // often the single most common colour in the image. They must not win.
  it('ignores letterbox black even when it is the majority', () => {
    const data = pixels(...repeat([0, 0, 0, 255], 100), ...repeat([220, 60, 30, 255], 10))
    expect(dominantColor(data)).toEqual({ r: 220, g: 60, b: 30 })
  })

  it('ignores a near-white majority the same way', () => {
    const data = pixels(...repeat([255, 255, 255, 255], 100), ...repeat([30, 90, 200, 255], 10))
    expect(dominantColor(data)).toEqual({ r: 30, g: 90, b: 200 })
  })

  it('ignores transparent pixels', () => {
    const data = pixels(...repeat([200, 40, 40, 0], 50), ...repeat([40, 160, 80, 255], 5))
    expect(dominantColor(data)).toEqual({ r: 40, g: 160, b: 80 })
  })

  it('returns null when nothing usable is left', () => {
    expect(dominantColor(pixels(...repeat([0, 0, 0, 255], 20)))).toBeNull()
    expect(dominantColor(new Uint8ClampedArray())).toBeNull()
  })

  // The real failure this was written against: music-video thumbnails are
  // mostly dark, desaturated background, so the literal most-common colour
  // came back near-black grey on cover after cover. The pill wants the
  // colour the artwork reads as, which is the saturated one even when it is
  // heavily outnumbered.
  it('prefers a saturated minority over a desaturated majority', () => {
    const data = pixels(...repeat([40, 42, 44, 255], 200), ...repeat([200, 30, 60, 255], 12))
    expect(dominantColor(data)).toEqual({ r: 200, g: 30, b: 60 })
  })

  it('still returns something for genuinely monochrome artwork', () => {
    // Nothing saturated anywhere — the fallback has to give a grey rather
    // than give up and leave the pill neutral.
    const result = dominantColor(pixels(...repeat([120, 122, 121, 255], 30)))
    expect(result).not.toBeNull()
    expect(result!.r).toBeGreaterThan(100)
  })
})

describe('textOn', () => {
  it('puts dark text on a light background', () => {
    expect(textOn({ r: 255, g: 255, b: 255 })).toBe('ink')
    expect(textOn({ r: 240, g: 220, b: 120 })).toBe('ink')
  })

  it('puts light text on a dark background', () => {
    expect(textOn({ r: 0, g: 0, b: 0 })).toBe('on-dark')
    expect(textOn({ r: 30, g: 40, b: 90 })).toBe('on-dark')
  })

  // Green carries far more luminance than blue at the same channel value, so a
  // naive average would get this pair backwards.
  it('weights channels perceptually', () => {
    expect(textOn({ r: 0, g: 200, b: 0 })).toBe('ink')
    expect(textOn({ r: 0, g: 0, b: 200 })).toBe('on-dark')
  })
})

describe('pillTint', () => {
  /** Cheap lightness proxy, good enough to assert a band. */
  const lightness = ({ r, g, b }: { r: number; g: number; b: number }) =>
    (Math.max(r, g, b) + Math.min(r, g, b)) / 2 / 255

  // Real covers extract dark: rgb(38,56,56) and rgb(74,66,32) came off an
  // actual playlist. Dropped straight into the pill they read as near-black
  // slabs on a light nav, and every track looks alike.
  it('lifts a dark cover colour into a light band', () => {
    const tint = pillTint({ r: 38, g: 56, b: 56 })
    expect(lightness(tint)).toBeGreaterThan(0.75)
    expect(lightness(tint)).toBeLessThan(0.95)
  })

  it('keeps the hue it was given', () => {
    // Teal in, teal out: blue and green stay above red.
    const tint = pillTint({ r: 38, g: 56, b: 56 })
    expect(tint.g).toBeGreaterThan(tint.r)
    expect(tint.b).toBeGreaterThan(tint.r)
  })

  it('distinguishes different hues from each other', () => {
    const teal = pillTint({ r: 38, g: 56, b: 56 })
    const olive = pillTint({ r: 74, g: 66, b: 32 })
    expect(teal).not.toEqual(olive)
  })

  it('tames a neon colour rather than passing it through', () => {
    const tint = pillTint({ r: 0, g: 255, b: 0 })
    expect(lightness(tint)).toBeGreaterThan(0.75)
    expect(Math.min(tint.r, tint.g, tint.b)).toBeGreaterThan(60)
  })

  // A genuinely grey cover should give a grey pill. Inventing a hue that is
  // not in the artwork would be worse than being plain.
  it('leaves a desaturated colour desaturated', () => {
    const tint = pillTint({ r: 120, g: 122, b: 121 })
    expect(Math.max(tint.r, tint.g, tint.b) - Math.min(tint.r, tint.g, tint.b)).toBeLessThan(20)
  })

  it('always produces something dark ink text stays legible on', () => {
    for (const rgb of [
      { r: 38, g: 56, b: 56 },
      { r: 0, g: 0, b: 0 },
      { r: 200, g: 30, b: 60 },
      { r: 255, g: 255, b: 0 },
    ]) {
      expect(textOn(pillTint(rgb))).toBe('ink')
    }
  })
})

describe('toCss', () => {
  it('formats as rgb()', () => {
    expect(toCss({ r: 1, g: 2, b: 3 })).toBe('rgb(1 2 3)')
  })
})
