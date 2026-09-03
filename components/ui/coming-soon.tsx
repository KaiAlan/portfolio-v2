import Link from 'next/link'

/**
 * The placeholder for a route that is linked but not built yet.
 *
 * A real page rather than a 404 or a removed link: `/about` was in the nav
 * and returned 404, which is the worst of the three options — the site
 * promises something and then denies it exists. Saying "not yet" keeps the
 * promise honest and keeps the nav's shape stable for when the page lands.
 *
 * Deliberately quiet. This is the least interesting screen on the site and
 * should not perform: a line, a sentence, and the way back to the work.
 */
const ComingSoon = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <main className="flex w-full flex-1 items-center justify-center px-6 py-24">
    <div className="flex max-w-md flex-col items-center gap-4 text-center">
      <h1 className="type-display-lg tracking-tight text-ink">{title}</h1>
      <p className="type-body text-muted">{children}</p>
      <Link
        href="/"
        className="type-button mt-2 rounded-pill bg-ink px-5 py-2.5 text-on-dark transition-opacity hover:opacity-90"
      >
        See the work
      </Link>
    </div>
  </main>
)

export default ComingSoon
