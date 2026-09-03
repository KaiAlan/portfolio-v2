/** Shared motion constants.
 *
 *  The card -> lightbox morph is a shared-layout animation across a parallel
 *  route boundary: the card lives in the feed, the media lives in the @modal
 *  slot. Both ends must use the SAME transition or motion interpolates two
 *  different curves against each other and the morph visibly hitches.
 */

/** The card -> media morph. Fast and unbouncy: the reference settles in
 *  ~180ms with no overshoot, so damping is high relative to stiffness. */
export const MORPH_SPRING = {
  type: 'spring',
  stiffness: 460,
  damping: 42,
  mass: 0.8,
} as const

/** The backdrop blur lands before the morph rather than tracking it — in the
 *  reference the feed is already washed out on the frame after the click. */
export const BACKDROP_FADE = { duration: 0.12, ease: 'easeOut' } as const

/** Panel copy trails the morph slightly instead of arriving with it. */
export const PANEL_FADE = { duration: 0.2, ease: 'easeOut', delay: 0.08 } as const
