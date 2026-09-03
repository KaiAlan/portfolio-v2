/** Pulling a pill colour out of a cover thumbnail.
 *
 *  Pure on purpose: the canvas work that produces the pixel data is I/O and
 *  lives in the provider, while the decisions about that data are testable
 *  here — same split as lib/admin/*.
 */

export type RGB = { r: number; g: number; b: number }

/** Below this on every channel is treated as letterbox black, not content. */
const NEAR_BLACK = 32
/** Above this on every channel is treated as blown-out white, not content. */
const NEAR_WHITE = 232
/** Alpha below this is not really on screen. */
const MIN_ALPHA = 125
/** HSV saturation below this reads as grey, not as a colour. */
const MIN_SATURATION = 0.18

/** HSV saturation, 0 (grey) to 1 (fully saturated). */
function saturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b)
  if (max === 0) return 0
  return (max - Math.min(r, g, b)) / max
}

/**
 * The most common colour in the image, ignoring what isn't really content.
 *
 * Buckets by the top 4 bits of each channel rather than exact values, so
 * near-identical shades of the same colour reinforce each other instead of
 * splitting the vote 400 ways and losing to a flat background.
 *
 * The skips are load-bearing. `hqdefault.jpg` letterboxes 16:9 video into a
 * 4:3 frame, so black bars are routinely the single most common colour in the
 * image — taking the raw winner would tint almost every pill black. Averaging
 * instead of bucketing has the opposite failure: it returns a muddy grey that
 * appears nowhere in the artwork.
 *
 * Returns null when nothing usable survives, which the caller reads as
 * "keep the neutral pill" rather than as an error.
 */
export function dominantColor(data: Uint8ClampedArray): RGB | null {
  type Bucket = { count: number; r: number; g: number; b: number }

  /** One pass over the pixels, optionally ignoring greyish ones. */
  const tally = (colourfulOnly: boolean) => {
    const buckets = new Map<number, Bucket>()

    for (let i = 0; i + 3 < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]

      if (data[i + 3] < MIN_ALPHA) continue
      if (r < NEAR_BLACK && g < NEAR_BLACK && b < NEAR_BLACK) continue
      if (r > NEAR_WHITE && g > NEAR_WHITE && b > NEAR_WHITE) continue
      if (colourfulOnly && saturation(r, g, b) < MIN_SATURATION) continue

      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      const bucket = buckets.get(key)
      if (bucket) {
        bucket.count += 1
        bucket.r += r
        bucket.g += g
        bucket.b += b
      } else {
        buckets.set(key, { count: 1, r, g, b })
      }
    }

    let best: Bucket | null = null
    for (const bucket of buckets.values()) {
      if (!best || bucket.count > best.count) best = bucket
    }
    return best
  }

  // Colourful pixels first. A cover's background is usually a large, dark,
  // desaturated mass, so the literal most-common colour comes back as murky
  // grey on almost every real thumbnail — verified against actual playlists.
  // The colour the artwork *reads* as is the saturated one, even outnumbered
  // twenty to one. Monochrome artwork falls through to the second pass rather
  // than losing its tint entirely.
  const winner = tally(true) ?? tally(false)
  if (!winner) return null

  // Average within the winning bucket: the bucket is a range, and its members'
  // mean is a truer colour than the range's midpoint.
  return {
    r: Math.round(winner.r / winner.count),
    g: Math.round(winner.g / winner.count),
    b: Math.round(winner.b / winner.count),
  }
}

/** sRGB channel to linear, per WCAG. */
function linearise(channel: number): number {
  const c = channel / 255
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}

/**
 * Which text token stays legible on this background.
 *
 * WCAG relative luminance rather than a channel average, because the eye is
 * far more sensitive to green than to blue: pure green and pure blue at the
 * same value read as completely different brightnesses, and an average calls
 * them identical.
 */
export function textOn(rgb: RGB): 'ink' | 'on-dark' {
  const luminance =
    0.2126 * linearise(rgb.r) + 0.7152 * linearise(rgb.g) + 0.0722 * linearise(rgb.b)
  return luminance > 0.35 ? 'ink' : 'on-dark'
}

/* ------------------------------------------------------------------ *
 * Turning an extracted colour into a usable pill background
 * ------------------------------------------------------------------ */

/** The band a pill background may occupy. Light enough to sit on the canvas
 *  without becoming a slab, saturated enough to read as a colour. */
const TINT_LIGHTNESS = { min: 0.82, max: 0.9 }
const TINT_MAX_SATURATION = 0.55

function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const rn = r / 255
  const gn = g / 255
  const bn = b / 255
  const max = Math.max(rn, gn, bn)
  const min = Math.min(rn, gn, bn)
  const l = (max + min) / 2
  const delta = max - min
  if (delta === 0) return { h: 0, s: 0, l }

  const s = l > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let h: number
  if (max === rn) h = ((gn - bn) / delta + (gn < bn ? 6 : 0)) / 6
  else if (max === gn) h = ((bn - rn) / delta + 2) / 6
  else h = ((rn - gn) / delta + 4) / 6
  return { h, s, l }
}

function hslToRgb({ h, s, l }: { h: number; s: number; l: number }): RGB {
  if (s === 0) {
    const v = Math.round(l * 255)
    return { r: v, g: v, b: v }
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    let x = t
    if (x < 0) x += 1
    if (x > 1) x -= 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return {
    r: Math.round(channel(h + 1 / 3) * 255),
    g: Math.round(channel(h) * 255),
    b: Math.round(channel(h - 1 / 3) * 255),
  }
}

/**
 * Maps an extracted cover colour into a background the nav can actually wear.
 *
 * Raw dominant colours are almost always too dark to use directly — real
 * covers gave back rgb(38,56,56) and rgb(74,66,32), which render as near-black
 * slabs on a light header and make every track look identical. Hue is the part
 * that carries "this is that cover"; lightness and saturation are free to be
 * normalised, and normalising them is what makes the tint read as intentional
 * rather than muddy.
 *
 * Saturation is only ever clamped DOWN. A grey cover gets a grey pill —
 * inventing a hue that is not in the artwork would be worse than being plain.
 */
export function pillTint(rgb: RGB): RGB {
  const { h, s, l } = rgbToHsl(rgb)
  return hslToRgb({
    h,
    s: Math.min(s, TINT_MAX_SATURATION),
    l: Math.min(Math.max(l, TINT_LIGHTNESS.min), TINT_LIGHTNESS.max),
  })
}

export function toCss(rgb: RGB): string {
  return `rgb(${rgb.r} ${rgb.g} ${rgb.b})`
}
