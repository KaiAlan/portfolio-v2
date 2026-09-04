import { describe, expect, it } from 'vitest'
import {
  PREVIEW_CURSOR_GAP,
  PREVIEW_EDGE,
  containedWidthFraction,
  previewPlacement,
  previewSize,
} from './feed-layout'

describe('containedWidthFraction', () => {
  it('fills the cell exactly when the shot matches the cell aspect', () => {
    expect(containedWidthFraction(1, 1)).toBe(1)
    expect(containedWidthFraction(1.5, 1.5)).toBe(1)
  })

  it('fills the width and shrinks below full height for a wider shot', () => {
    // Landscape 2:1 shot in a square cell — bound by width, letterboxed
    // top/bottom (the caller derives height from aspect-ratio + this width).
    expect(containedWidthFraction(2, 1)).toBe(1)
  })

  it('shrinks the width for a taller shot', () => {
    // Portrait 1:2 shot in a square cell — bound by height, so the box is
    // half the cell's width.
    expect(containedWidthFraction(0.5, 1)).toBe(0.5)
  })

  it('scales relative to a non-square cell', () => {
    // 4:3 cell, 4:3 shot — exact fit.
    expect(containedWidthFraction(4 / 3, 4 / 3)).toBe(1)
    // Same cell, a taller 1:1 shot is bound by height: width = Ai/Ac = 0.75.
    expect(containedWidthFraction(1, 4 / 3)).toBeCloseTo(0.75)
  })

  it('falls back to filling the cell for degenerate input', () => {
    expect(containedWidthFraction(0, 1)).toBe(1)
    expect(containedWidthFraction(-2, 1)).toBe(1)
    expect(containedWidthFraction(1, 0)).toBe(1)
  })
})

describe('previewSize', () => {
  // 1600x900 desktop: the 2xl tier (720) beats 0.78 * 900 = 702, so height
  // is viewport-bound at 702.
  it('is height-led, capped by the viewport', () => {
    expect(previewSize(0.8, 1600, 900)).toEqual({ width: 562, height: 702 })
  })

  it('grows with the viewport width tier', () => {
    // Same shot, same viewport height — a wider screen gets a taller box
    // only until the 0.78 * vh ceiling bites, so compare at a tall viewport.
    const laptop = previewSize(0.8, 1200, 1400).height
    const wide = previewSize(0.8, 1400, 1400).height
    const wider = previewSize(0.8, 1600, 1400).height
    expect(laptop).toBe(520)
    expect(wide).toBe(620)
    expect(wider).toBe(720)
  })

  it('lets the width cap take the height down with it', () => {
    // A 3:1 panorama at the 720 tier wants 2160px of width; the cap is
    // 0.44 * 1600 = 704, so the height drops to 704 / 3.
    const box = previewSize(3, 1600, 1400)
    expect(box.width).toBe(704)
    expect(box.height).toBe(Math.round(704 / 3))
  })

  it('treats degenerate dimensions as square', () => {
    expect(previewSize(0, 1600, 900)).toEqual(previewSize(1, 1600, 900))
    expect(previewSize(-2, 1600, 900)).toEqual(previewSize(1, 1600, 900))
  })
})

describe('previewPlacement', () => {
  const box = { width: 400, height: 700 }

  it('sits beside the cursor when there is room', () => {
    expect(previewPlacement(300, 450, box, 1600, 900).x).toBe(300 + PREVIEW_CURSOR_GAP)
  })

  it('flips to the cursor left rather than running off the right edge', () => {
    // 1400 + 32 + 400 = 1832 > 1600 - 24, so it goes to the left instead.
    expect(previewPlacement(1400, 450, box, 1600, 900).x).toBe(
      1400 - PREVIEW_CURSOR_GAP - 400,
    )
  })

  it('clamps y so the box cannot be cut at the top', () => {
    // This is the regression: the cursor on an early row put the box's
    // centre at 150, i.e. its top edge 200px above the window.
    expect(previewPlacement(300, 150, box, 1600, 900).y).toBe(PREVIEW_EDGE + 350)
  })

  it('clamps y at the bottom too', () => {
    expect(previewPlacement(300, 880, box, 1600, 900).y).toBe(900 - PREVIEW_EDGE - 350)
  })

  it('follows the cursor between the clamps', () => {
    expect(previewPlacement(300, 450, box, 1600, 900).y).toBe(450)
  })

  it('centres a box too tall to fit rather than picking an edge', () => {
    expect(previewPlacement(300, 100, { width: 400, height: 1200 }, 1600, 900).y).toBe(450)
  })
})
