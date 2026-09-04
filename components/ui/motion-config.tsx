'use client'

import { MotionConfig } from 'motion/react'
import type { ReactNode } from 'react'

/**
 * App-wide motion configuration.
 *
 * A client boundary, because `motion/react`'s dist carries no `"use client"`
 * of its own — importing `MotionConfig` straight into the root layout, which
 * is a server component, would fail.
 *
 * `reducedMotion="user"` is the whole point. It reads the OS preference and
 * makes every Motion element **skip transform and layout animations** while
 * leaving opacity and colour animating normally
 * (`framer-motion.dev.js:7108`). That is exactly what WCAG SC 2.3.3 asks for
 * — reduce, not remove — and it is the correct behaviour for free rather than
 * something each component has to remember.
 *
 * It only covers what Motion drives, though. Tailwind's `animate-pulse`,
 * plain CSS transitions and the YouTube iframe never pass through here, which
 * is why `globals.css` carries a `prefers-reduced-motion` block as well. Both
 * halves are needed; neither is redundant.
 *
 * The alternatives are worth naming so nobody "simplifies" this to one of
 * them: `"always"` and `"never"` force the setting and skip installing the
 * `matchMedia` listener entirely, so they are for testing, not for shipping.
 */
const MotionProvider = ({ children }: { children: ReactNode }) => (
  <MotionConfig reducedMotion="user">{children}</MotionConfig>
)

export default MotionProvider
