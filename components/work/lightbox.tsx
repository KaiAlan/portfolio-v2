'use client'

import { AnimatePresence, motion } from 'motion/react'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, type ReactNode } from 'react'

/**
 * The lightbox shell for an intercepted /work/[slug].
 *
 * Close is router.back(), not a push to "/": the grid is the previous
 * history entry, so going back restores its scroll position and active
 * filter for free. Prev/next replace the entry instead of pushing, so a
 * long browse doesn't bury the grid under twenty history states.
 *
 * The inner panel carries the same layoutId as the card that opened it,
 * which is what produces the card -> detail morph.
 */

type LightboxProps = {
  layoutId: string
  prevHref: string | null
  nextHref: string | null
  children: ReactNode
}

const Lightbox = ({ layoutId, prevHref, nextHref, children }: LightboxProps) => {
  const router = useRouter()
  const panelRef = useRef<HTMLDivElement>(null)
  const touchStartX = useRef<number | null>(null)

  const close = useCallback(() => router.back(), [router])

  const go = useCallback(
    (href: string | null) => {
      if (href) router.replace(href, { scroll: false })
    },
    [router],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
      else if (event.key === 'ArrowLeft') go(prevHref)
      else if (event.key === 'ArrowRight') go(nextHref)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [close, go, prevHref, nextHref])

  // Lock the page behind the overlay, restoring whatever was there before
  // rather than assuming it was scrollable.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const onTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0]?.clientX ?? null
  }

  const onTouchEnd = (event: React.TouchEvent) => {
    const start = touchStartX.current
    touchStartX.current = null
    if (start === null) return

    const delta = (event.changedTouches[0]?.clientX ?? start) - start
    if (Math.abs(delta) < 60) return
    go(delta > 0 ? prevHref : nextHref)
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-100 flex items-start justify-center overflow-y-auto overscroll-contain bg-ink/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={close}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        role="dialog"
        aria-modal="true"
      >
        <motion.div
          ref={panelRef}
          layoutId={layoutId}
          transition={{ type: 'spring', stiffness: 350, damping: 40 }}
          className="my-6 w-full max-w-5xl rounded-card bg-canvas"
          // The backdrop closes; the panel must not.
          onClick={(event) => event.stopPropagation()}
        >
          {children}
        </motion.div>

        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="type-button fixed top-4 right-4 z-10 rounded-pill bg-canvas px-4 py-2 text-ink"
        >
          Close
        </button>

        {prevHref && (
          <NavButton side="left" href={prevHref} onGo={go} label="Previous project" />
        )}
        {nextHref && <NavButton side="right" href={nextHref} onGo={go} label="Next project" />}
      </motion.div>
    </AnimatePresence>
  )
}

type NavButtonProps = {
  side: 'left' | 'right'
  href: string
  onGo: (href: string) => void
  label: string
}

const NavButton = ({ side, href, onGo, label }: NavButtonProps) => (
  <button
    type="button"
    aria-label={label}
    onClick={(event) => {
      event.stopPropagation()
      onGo(href)
    }}
    className={`type-button fixed top-1/2 z-10 hidden -translate-y-1/2 rounded-pill bg-canvas px-3 py-2 text-ink md:block ${
      side === 'left' ? 'left-4' : 'right-4'
    }`}
  >
    {side === 'left' ? '←' : '→'}
  </button>
)

export default Lightbox
