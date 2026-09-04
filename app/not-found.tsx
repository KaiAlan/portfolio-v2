import Link from 'next/link'
import Navbar from '@/components/navbar/navbar'
import { Button } from '@/components/ui/button'

/**
 * Renders its own header. This file sits at the document root so it can catch
 * an unmatched URL anywhere, which puts it outside `(site)` — and therefore
 * outside the layout that supplies the nav to every other public page.
 *
 * notFound() in an on-demand dynamic segment is a SOFT 404: Cache
 * Components streams a static shell first, so the 200 is already sent and
 * the status cannot change (see Next's not-found docs). Next injects
 * <meta name="robots" content="noindex"> itself, so this stays out of the
 * index. A hard 404 would mean checking the slug in proxy.ts before the
 * response streams — deferred until there is a reason to pay for it.
 */

const NotFound = () => (
  <>
    <Navbar />
    <main className="flex w-full flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="type-display-lg">Not found</h1>
      <p className="type-body text-muted">That page doesn&apos;t exist, or it was unpublished.</p>
      <Button asChild className="mt-2">
        <Link
        href="/"
        
      >Back to work</Link>
      </Button>
    </main>
  </>
)

export default NotFound
