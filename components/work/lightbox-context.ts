'use client'

import { createContext, useContext } from 'react'

/**
 * Lets the detail view drive the lightbox without prop-drilling.
 *
 * The controls (close, prev, next) belong visually inside the detail panel,
 * but the behaviour they trigger — history navigation, the two-phase close —
 * belongs to the lightbox shell. The panel is also rendered by the plain
 * /work/[slug] page, where none of that exists.
 *
 * `useLightbox()` therefore returns null on the page, which is the signal to
 * render no controls at all rather than dead ones.
 */

export type LightboxControls = {
  close: () => void
  goPrev: () => void
  goNext: () => void
  hasPrev: boolean
  hasNext: boolean
  /** False once closing has begun — drives the panel out and unmounts the
   *  media so the grid card can morph back into place. */
  open: boolean
}

export const LightboxContext = createContext<LightboxControls | null>(null)

export const useLightbox = () => useContext(LightboxContext)

/* --------------------------------------------------------------------------
   Opening vs switching.

   Arrow-keying to the next project is a router.replace, which changes the
   dynamic segment and therefore REMOUNTS the whole modal subtree. Component
   state cannot tell the two apart, because the component being asked is
   itself brand new — so the panel replayed its slide-in on every switch.

   This counter lives outside React and survives the remount. React renders
   the incoming tree before running the outgoing tree's cleanups, so during a
   switch the previous lightbox is still mounted and the count is non-zero;
   on a genuine open from the grid, it is zero.
   -------------------------------------------------------------------------- */

let mountedLightboxes = 0

export const acquireLightbox = () => {
  mountedLightboxes += 1
}

export const releaseLightbox = () => {
  mountedLightboxes = Math.max(0, mountedLightboxes - 1)
}

/** True when another lightbox is already on screen — i.e. this is a switch
 *  between projects, not a fresh open, so the panel must not re-animate. */
export const lightboxAlreadyOpen = () => mountedLightboxes > 0
