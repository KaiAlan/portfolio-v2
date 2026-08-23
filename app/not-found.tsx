import Link from 'next/link'

const NotFound = () => (
  <main className="flex w-full flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
    <h1 className="type-display-lg">Not found</h1>
    <p className="type-body text-muted">That page doesn&apos;t exist, or it was unpublished.</p>
    <Link
      href="/"
      className="type-button mt-2 rounded-pill bg-ink px-4 py-2 text-on-dark transition-opacity hover:opacity-90"
    >
      Back to work
    </Link>
  </main>
)

export default NotFound
