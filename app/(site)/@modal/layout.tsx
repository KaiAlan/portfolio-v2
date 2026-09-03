import { Suspense } from 'react'

/**
 * Holds the Suspense boundary for the intercepted lightbox.
 *
 * It has to live in the slot's layout rather than in the page. The page is
 * keyed by [slug], so arrow-keying between projects unmounts it and mounts a
 * fresh one — and a *newly mounted* boundary always shows its fallback rather
 * than holding the previous UI through the transition. That made the whole
 * lightbox blink out and back on every prev/next.
 *
 * This layout is not keyed by the slug, so the boundary persists across those
 * navigations and React keeps the current project on screen until the next one
 * is ready.
 *
 * The fallback is null, not a skeleton: on a first open this sits above a feed
 * that is already on screen, and a placeholder panel flashing before the real
 * one would read as a glitch.
 */
const ModalLayout = ({ children }: { children: React.ReactNode }) => (
  <Suspense fallback={null}>{children}</Suspense>
)

export default ModalLayout
