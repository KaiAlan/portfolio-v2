import { Suspense } from 'react'
import PrimaryLinks, { PrimaryLinksList } from './primary-links'
import ProfileCard from './profile-card'

/**
 * Full-bleed sticky header: identity and page links. The category filter is
 * NOT here — it belongs to the homepage, so the feed renders it as its own
 * sticky row directly beneath this one. The two stack visually and scroll as
 * one, without the header having to know which page it is on.
 *
 * Opaque, never translucent: this bar is constant on every page, so it must
 * read as one fixed plane rather than picking up whatever scrolls beneath it.
 *
 * Sits directly on the canvas with no border and no shadow — elevation in this
 * system is either absent or the one soft float, and the header is flat.
 *
 * No search field: decision #15 keeps search out of v1. Curation is the point,
 * and a search box is a maintenance tax on a feed of tens of items.
 */
const Navbar = () => (
  <header className="sticky top-0 z-50 w-full bg-canvas">
    <div className="flex h-16 w-full items-center justify-between gap-6 px-4 sm:px-6 lg:px-9">
      <div className="flex min-w-0 items-center gap-6">
        <ProfileCard />

        <Suspense fallback={<PrimaryLinksList pathname={null} />}>
          <PrimaryLinks />
        </Suspense>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <a
          href="https://x.com/kaialan__"
          target="_blank"
          rel="noreferrer"
          className="type-button rounded-pill px-3 py-2 text-muted transition-colors hover:text-ink"
        >
          X
        </a>
        <a
          href="mailto:dev.kaialan@gmail.com"
          className="type-button rounded-pill bg-ink px-4 py-2 text-on-dark transition-opacity hover:opacity-90"
        >
          Contact
        </a>
      </div>
    </div>
  </header>
)

export default Navbar
