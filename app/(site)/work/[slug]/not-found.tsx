import Link from 'next/link'

/**
 * notFound() in an on-demand dynamic segment is a SOFT 404: Cache
 * Components streams a static shell first, so the 200 is already sent and
 * the status cannot change (see Next's not-found docs). Next injects
 * <meta name="robots" content="noindex"> itself, so this stays out of the
 * index. A hard 404 would mean checking the slug in proxy.ts before the
 * response streams — deferred until there is a reason to pay for it.
 */

const ProjectNotFound = () => (
  <main className="flex w-full flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
    <h1 className="type-display-lg">Project not found</h1>
    <p className="type-body text-muted">
      It may have been unpublished, or the link may have changed.
    </p>
    <Link
      href="/"
      className="type-button mt-2 rounded-pill bg-ink px-4 py-2 text-on-dark transition-opacity hover:opacity-90"
    >
      Back to work
    </Link>
  </main>
)

export default ProjectNotFound
