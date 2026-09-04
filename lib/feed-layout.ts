/**
 * Pure sizing math for the feed's grid layout.
 *
 * Grid cells are a fixed 4:3 landscape rectangle so every row lines up
 * regardless of column count — unlike masonry, which packs to the shortest
 * column. A shot rarely fills that exactly, so its media box sits centred
 * inside the cell at its own true aspect ratio, letting the card's ground
 * colour show as a border around it (the "contained" grid card, as opposed
 * to a cropped/cover one).
 *
 * This box has to be sized ahead of paint, not measured, because it is also
 * the `layoutId` morph target: the lightbox's own box is the shot's true
 * aspect ratio, and a morph between two different aspect ratios stretches
 * the video/image inside it for the duration of the animation (see
 * docs/MOTION.md's `layoutId` section). Since both the cell's aspect ratio
 * and the shot's are known upfront, the contained box is a closed-form
 * calculation rather than a DOM measurement — no ResizeObserver per card.
 */

/** Every grid cell is 4:3. Masonry stays the natural-aspect layout; this is
 *  the deliberately uniform alternative. */
export const GRID_CELL_ASPECT = 4 / 3

/**
 * Fraction (0–1] of the cell's width the contained box should occupy.
 * Pair with `aspectRatio: shotAspect` on the box and its height falls out
 * of that ratio automatically — no separate height fraction needed.
 *
 * `shotAspect <= 0` (missing/degenerate dimensions) falls back to filling
 * the cell, same defensive default as the masonry layout's `aspect || 1`.
 */
export function containedWidthFraction(shotAspect: number, cellAspect: number): number {
  if (!(shotAspect > 0) || !(cellAspect > 0)) return 1
  return Math.min(1, shotAspect / cellAspect)
}

/* ------------------------------------------------------------------ *
 * Index-view preview
 *
 * The floating cover in `components/feed/index-layout.tsx`. Sized and
 * placed here, in closed form, for two reasons:
 *
 *   1. The clamp needs the height in JS anyway. The box is centred on the
 *      cursor, so keeping it inside the window means knowing how tall it
 *      is — and once that is here, deriving the width here too removes a
 *      CSS/JS split over one box.
 *   2. A CSS width cap cannot take the height down with it. The old box
 *      was `h-[360px]` + `aspect-ratio` + `max-w-[38vw]`: the ratio did
 *      size it correctly for ordinary shots (measured), but when the cap
 *      bit — a panorama at 3:1 wants 1560px against a 608px cap — the box
 *      stopped being the shot's ratio and `object-cover` cropped it hard.
 *      Here the cap recomputes the height instead.
 *
 * Both were found by measuring the live DOM over CDP rather than reasoning
 * about the cascade; the first draft of this comment guessed a `width:auto`
 * stretch-fit bug that the measurement disproved.
 * ------------------------------------------------------------------ */

/** Breathing room kept between the preview and the window edge. */
export const PREVIEW_EDGE = 24

/** Horizontal gap from the cursor, so the preview sits BESIDE the pointer
 *  rather than under it — a box under the cursor covers the row it
 *  describes. */
export const PREVIEW_CURSOR_GAP = 32

export type PreviewBox = { width: number; height: number }

/** Target height by viewport width. The index view leaves most of a wide
 *  screen empty, so the preview grows into it rather than staying at the
 *  height a 1024px laptop needs. */
export function previewHeightTier(viewportWidth: number): number {
  if (viewportWidth < 1280) return 520
  if (viewportWidth < 1536) return 620
  return 720
}

/**
 * The preview's box: height-led, then clamped by width.
 *
 * Height leads because the preview IS the shot — no card, no ground — so a
 * consistent height is what makes a portrait and a landscape cover read as
 * the same size of thing. The width cap is a guard, not a size: a wide
 * panorama would otherwise run most of the way across the page, and when it
 * bites the height comes down with it rather than the shot being squashed.
 */
export function previewSize(
  shotAspect: number,
  viewportWidth: number,
  viewportHeight: number,
): PreviewBox {
  // Same defensive default as the masonry layout's `aspect || 1`.
  const aspect = shotAspect > 0 ? shotAspect : 1

  let height = Math.min(previewHeightTier(viewportWidth), viewportHeight * 0.78)
  let width = height * aspect

  const maxWidth = viewportWidth * 0.44
  if (width > maxWidth) {
    width = maxWidth
    height = width / aspect
  }

  return { width: Math.round(width), height: Math.round(height) }
}

/**
 * Where to put it, given the cursor.
 *
 * `y` is the box's CENTRE — the node carries a `-translate-y-1/2` — so the
 * clamp keeps half a box off each edge. A box taller than the viewport
 * cannot satisfy that, and centring is the least wrong answer.
 *
 * `x` flips to the cursor's left when the preview would otherwise run past
 * the right edge. Index rows span nearly the full width and the pointer is
 * usually mid-row, so without the flip a wide cover is simply cut off.
 */
export function previewPlacement(
  cursorX: number,
  cursorY: number,
  box: PreviewBox,
  viewportWidth: number,
  viewportHeight: number,
): { x: number; y: number } {
  const right = cursorX + PREVIEW_CURSOR_GAP
  const x =
    right + box.width > viewportWidth - PREVIEW_EDGE
      ? Math.max(PREVIEW_EDGE, cursorX - PREVIEW_CURSOR_GAP - box.width)
      : right

  const half = box.height / 2
  const min = PREVIEW_EDGE + half
  const max = viewportHeight - PREVIEW_EDGE - half
  const y = max < min ? viewportHeight / 2 : Math.min(Math.max(cursorY, min), max)

  return { x, y }
}
