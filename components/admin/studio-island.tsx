'use client'

import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { logout } from '@/app/admin/login/actions'
import { spring } from '@/lib/motion'
import { cn } from '@/lib/utils'

/**
 * The studio's entire chrome: one dark island hanging from the top edge.
 *
 * It replaced, in three passes on 2026-09-04, a full-width 40px dark toolbar
 * holding these same two items at opposite ends of the screen, then the dark
 * frame that surrounded the whole panel. Two words of chrome did not need a
 * band of the viewport, and the frame around it did not need the rest. This
 * is now the only thing on screen that says "admin", which is why it is the
 * only element allowed to be dark: on a white page a dark shape at the top
 * edge reads as chrome with no surrounding structure needed to explain it.
 *
 * Flush at the top with only its bottom corners rounded — hanging from the
 * edge rather than floating below it.
 *
 * COLLAPSING is the point of the shape. At rest it is just the label; the
 * actions appear on hover, or on click for a pointer that cannot hover.
 * Clicking also *pins* it open, so the log-out button can be reached without
 * keeping the cursor inside the island the whole way — a hover-only reveal
 * is a target that moves away from you.
 *
 * Motion notes, both from docs/MOTION.md:
 *   - `layout` on the shape and `layout="position"` on the label. Motion
 *     animates size by scaling, so a text node inside a growing box smears
 *     unless it is told to move rather than scale.
 *   - `spring.chrome`, the docking preset. This is chrome parking at an
 *     edge, and chrome that wobbles when it parks reads as unstable.
 */
const StudioIsland = () => {
  const [hovering, setHovering] = useState(false)
  const [pinned, setPinned] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  const open = hovering || pinned

  // Only while pinned: a hover-open island closes itself when the pointer
  // leaves, so there is nothing to dismiss.
  useEffect(() => {
    if (!pinned) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPinned(false)
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setPinned(false)
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [pinned])

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center">
      <motion.div
        ref={root}
        layout
        transition={spring.chrome}
        onHoverStart={() => setHovering(true)}
        onHoverEnd={() => setHovering(false)}
        style={{ borderRadius: '0 0 18px 18px' }}
        className={cn(
          'pointer-events-auto flex h-11 items-center gap-1 bg-surface-dark',
          open ? 'pr-2 pl-5' : 'px-5',
        )}
      >
        <motion.button
          layout="position"
          type="button"
          onClick={() => setPinned((wasPinned) => !wasPinned)}
          aria-expanded={open}
          className="type-meta flex items-center gap-1.5 font-medium tracking-tight text-on-dark/70 transition-colors hover:text-on-dark"
        >
          Admin
          <ChevronDown
            aria-hidden
            className={cn(
              'size-3.5 transition-transform duration-(--dur-base) ease-(--ease-standard)',
              open && 'rotate-180',
            )}
            strokeWidth={2}
          />
        </motion.button>

        {open && (
          <motion.form
            layout="position"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.12, ease: [0, 0, 0.38, 0.9] }}
            action={logout}
          >
            <button
              type="submit"
              className="type-meta rounded-pill px-3 py-1.5 whitespace-nowrap text-on-dark/50 transition-colors hover:bg-on-dark/10 hover:text-on-dark"
            >
              Log out
            </button>
          </motion.form>
        )}
      </motion.div>
    </div>
  )
}

export default StudioIsland
