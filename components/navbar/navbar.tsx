import Link from 'next/link'
import { Suspense } from 'react'
import NavLinks, { NavLinksList } from './nav-links'

/**
 * Full-bleed sticky header. Sits directly on the canvas with no border and
 * no shadow — elevation in this system is either absent or the one soft
 * float, and the header is flat.
 *
 * No search field: decision #15 keeps search out of v1. Curation is the
 * point, and a search box is a maintenance tax on a feed of tens of items.
 */
const Navbar = () => (
  <header className="sticky top-0 z-50 w-full bg-canvas/85 backdrop-blur-md">
    <div className="flex h-16 w-full items-center justify-between gap-6 px-4 sm:px-6 lg:px-9">
      <div className="flex items-center gap-6">
        <Link href="/" className="type-body font-medium tracking-tight text-ink">
          Kaialan
        </Link>
        <Suspense fallback={<NavLinksList pathname={null} />}>
          <NavLinks />
        </Suspense>
      </div>

      <div className="flex items-center gap-1">
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
