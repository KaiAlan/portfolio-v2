import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'
import Navbar from '@/components/navbar/navbar'
import StudioIsland from '@/components/admin/studio-island'
import StudioToaster from '@/components/admin/studio-toaster'
import DeleteProjectProvider from '@/components/admin/delete-project-provider'

/** The studio reads through the Preview API, uncached and on purpose —
 *  editing against stale data is editing against a lie (lib/preview.ts). So
 *  navigation into it legitimately blocks, and Cache Components' instant
 *  validation is asserting something we do not want to be true.
 *
 *  On the layout this covers the static-shell check for the whole subtree
 *  (the highest `instant` in the tree wins for that one). It does NOT cover
 *  the per-navigation check: every Page segment is validated on its own, so
 *  each studio page carries its own `instant = false`. Verified — with this
 *  line alone both /admin and /admin/projects/[id] still warned.
 *
 *  Dev-only validation either way; this does not change what ships, and it
 *  does not make the redirect below a hard one. proxy.ts remains the gate. */
export const instant = false

export const metadata: Metadata = {
  title: 'Studio',
  robots: { index: false, follow: false },
}

/**
 * The studio shell: the site itself, with one island of chrome over it.
 *
 * The panel carries the *real* site header — the same `Navbar` the public
 * routes render, not a copy — so the thing being edited is visibly the thing
 * that ships. It also means the header can never drift from the site's:
 * there is one component.
 *
 * There used to be a dark frame around all of this, and a 40px dark toolbar
 * above it, and between them they were most of what the screen spent its
 * space on. Both are gone (2026-09-04). What says "admin" now is
 * `StudioIsland` alone — fixed, so it costs no layout height — and the
 * studio is otherwise the site at full size.
 *
 * The panel IS the scroll container, and that one fact is what makes the rest
 * work. It is exactly one viewport tall (`h-dvh`) and scrolls internally
 * rather than letting the document scroll.
 *
 * Keep it that way. Sticky offsets inside are measured from the panel, not
 * the viewport, so the header pins at `top-0` and --studio-chrome-h is the
 * header's own height with nothing else added. While the document scrolled,
 * that token was 40px short of the truth and every board header overlapped
 * the nav. (The panel's rounded top used to depend on this too — that radius
 * is gone along with the dark frame that gave it something to be rounded
 * against.)
 *
 * `min-h-0` is load-bearing next to `flex-1`: a flex child's default
 * `min-height:auto` refuses to shrink below its content, so the panel would
 * grow past the frame and scroll the document after all.
 *
 * `Navbar` is still passed `sticky={false}`: the wrapper here owns the
 * positioning, because the offset it needs is this frame's, not the site's.
 */
export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const session = await getSession()
  if (!session.isLoggedIn) redirect('/admin/login')

  return (
    /* The toaster wraps the frame rather than sitting inside the panel: its
       viewport is fixed to the viewport, and every studio route shares the one
       queue — including a message handed across a navigation, which is how the
       editor's delete reports back from the board it lands on. */
    <StudioToaster>
      {/* Inside the toaster because it reports through it, and OUTSIDE the
          panel because a delete has to outlive the editor page that started
          it — see the note in the provider. */}
      <DeleteProjectProvider>
        <div className="flex h-dvh flex-col bg-canvas">
          {/* The studio's only chrome. Fixed rather than in the flow, so the
              panel below runs the full height of the viewport. */}
          <StudioIsland />

          <div
            data-studio-scroll
            className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-canvas"
          >
            {/* Opaque: it is what the board scrolls underneath. The corners are
                the panel's to draw, not this element's. */}
            <div className="sticky top-0 z-40 border-b border-hairline bg-canvas">
              <Navbar sticky={false} />
            </div>

            {/* No top padding: each board's own pinned header supplies it, and
                padding here would sit above the sticky row and scroll away. */}
            <main className="flex-1 px-4 pb-8 sm:px-8">{children}</main>
          </div>
        </div>
      </DeleteProjectProvider>
    </StudioToaster>
  )
}
