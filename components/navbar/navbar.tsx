import { Suspense } from 'react'
import { Mail } from 'lucide-react'
import { cn } from '@/lib/utils'
import PrimaryLinks, { PrimaryLinksList } from './primary-links'
import ProfileCard from './profile-card'
import MusicPill from '@/components/music/music-pill'

/**
 * Full-bleed header: identity and page links on the left, the action cluster
 * on the right. The category filter is NOT here — it belongs to the homepage,
 * so the feed renders it as its own sticky row directly beneath this one. The
 * two stack visually and scroll as one, without the header having to know
 * which page it is on.
 *
 * Opaque, never translucent: this bar is constant on every page, so it must
 * read as one fixed plane rather than picking up whatever scrolls beneath it.
 *
 * Sits directly on the canvas with no border and no shadow — elevation in this
 * system is either absent or the one soft float, and the header is flat.
 *
 * No search field: decision #15 keeps search out of v1. Curation is the point,
 * and a search box is a maintenance tax on a feed of tens of items.
 *
 * The right-hand cluster steps *down* in weight from left to right — the pill
 * pair reads as one group, then the two icon buttons, with only the last one
 * inked. One filled element per cluster; more than one and nothing leads.
 */

/** TODO(kai): confirm the handle — this is a guess from your name. */
const BOOKING_URL = 'https://cal.com/kaialan'

const EMAIL = 'mailto:dev.kaialan@gmail.com'
const X_URL = 'https://x.com/kaialan__'

/** Lucide dropped its brand glyphs, so the X mark is inline. */
const XMark = () => (
  <svg viewBox="0 0 24 24" aria-hidden className="size-3.5" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
)

/** Shared by both icon buttons so the two stay the same size and shape. */
const iconButton = 'grid size-9 shrink-0 place-items-center rounded-pill transition-opacity hover:opacity-70'

const Navbar = ({ sticky = true }: { sticky?: boolean }) => (
  <header
    className={cn(
      'w-full bg-canvas',
      // The studio renders this inside a rounded panel, where a sticky bar
      // would peel out of the corner radius on scroll. Static there, sticky
      // everywhere else.
      sticky && 'sticky top-0 z-50',
    )}
  >
    <div className="flex h-(--nav-h) w-full items-center justify-between gap-6 px-4 sm:px-6 lg:px-9">
      <div className="flex min-w-0 items-center gap-6">
        <ProfileCard />

        <Suspense fallback={<PrimaryLinksList pathname={null} />}>
          <PrimaryLinks />
        </Suspense>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <MusicPill />

        <a
          href={BOOKING_URL}
          target="_blank"
          rel="noreferrer"
          className="type-button rounded-pill bg-control px-5 py-2.5 whitespace-nowrap text-ink transition-opacity hover:opacity-70"
        >
          Book a call
        </a>

        <a href={EMAIL} aria-label="Email Kaialan" className={cn(iconButton, 'bg-control text-ink')}>
          <Mail className="size-4" strokeWidth={2} />
        </a>

        <a
          href={X_URL}
          target="_blank"
          rel="noreferrer"
          aria-label="Kaialan on X"
          className={cn(iconButton, 'bg-ink text-on-dark')}
        >
          <XMark />
        </a>
      </div>
    </div>
  </header>
)

export default Navbar
