'use client'

import Link from 'next/link'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { tween } from '@/lib/motion'

/**
 * The identity block, with an about card on hover.
 *
 * Two details that are easy to get wrong:
 *
 * 1. The card is separated from the trigger by a visual gap. If that gap were
 *    margin, moving the pointer across it would leave the trigger, close the
 *    card, and make it unreachable. It is padding on the card's wrapper
 *    instead, so the hover region is continuous.
 * 2. Closing is delayed a beat. Without it, the pointer crossing between two
 *    hover targets flickers the card off and on.
 *
 * Opens on focus as well as hover, and closes on Escape, so it is reachable
 * without a pointer.
 */

/** TODO(kai): placeholder copy — replace with your own words before launch. */
const BIO =
  'Product designer, previously a programmer. I build the whole thing — the interface, the system underneath it, and the type it is set in.'

const QUOTE = {
  text: 'Good design is as little design as possible.',
  attribution: 'Dieter Rams',
}

const LINKS = [
  { label: 'X', href: 'https://x.com/kaialan__' },
  { label: 'Email', href: 'mailto:dev.kaialan@gmail.com' },
]

const ProfileCard = () => {
  const [open, setOpen] = useState(false)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    setOpen(true)
  }

  const hide = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      if (closeTimer.current) clearTimeout(closeTimer.current)
    }
  }, [])

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      <Link href="/" className="flex items-center gap-2.5">
        {/* Decorative: the adjacent name already carries the link's meaning,
            so alt is empty rather than repeating it to a screen reader. */}
        <img
          src="/pfp.jpg"
          alt=""
          width={28}
          height={28}
          className="size-7 rounded-pill object-cover"
        />
        <span className="type-body font-medium tracking-tight whitespace-nowrap text-ink">
          Kaialan Razz
        </span>
      </Link>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            // The exit carries its own, faster transition. An entrance is read
            // and an exit is not, so a popover that leaves at the same speed
            // it arrived feels like it is reluctant to go. 0.7x, which is the
            // ratio the whole duration scale uses.
            //
            // The `y` is a transform, so `MotionConfig reducedMotion="user"`
            // drops it and leaves the opacity fade — a cross-fade, which is
            // the correct reduction rather than no animation at all.
            exit={{ opacity: 0, y: -6, transition: tween.popoverOut }}
            transition={tween.fade}
            // pt-3 rather than mt-3: the gap has to be inside the hover target.
            className="absolute top-full left-0 z-50 w-[22rem] pt-3"
          >
            <div className="flex flex-col gap-4 rounded-lg border border-card-edge bg-canvas p-5 shadow-float">
              <div className="flex items-center gap-3">
                <img
                  src="/pfp.jpg"
                  alt=""
                  width={44}
                  height={44}
                  className="size-11 rounded-pill object-cover"
                />
                <div className="flex flex-col">
                  <span className="type-body font-medium tracking-tight text-ink">
                    Kaialan Razz
                  </span>
                  <span className="type-meta text-muted">Product designer · India</span>
                </div>
              </div>

              <p className="type-body text-muted">{BIO}</p>

              <figure className="flex flex-col gap-1.5 border-l border-hairline pl-3">
                <blockquote className="type-body text-ink">“{QUOTE.text}”</blockquote>
                <figcaption className="type-meta text-muted-soft">
                  {QUOTE.attribution}
                </figcaption>
              </figure>

              <div className="flex items-center gap-2 border-t border-hairline pt-3">
                {LINKS.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    target={link.href.startsWith('http') ? '_blank' : undefined}
                    rel={link.href.startsWith('http') ? 'noreferrer' : undefined}
                    className="type-button rounded-pill bg-surface-warm px-3 py-1.5 text-ink transition-opacity hover:opacity-70"
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default ProfileCard
