import type { ReactNode } from 'react'
import { Suspense } from 'react'
import StudioTabs, { StudioTabsList } from './studio-tabs'

/**
 * The one row every studio board starts with: what you are looking at on the
 * left, where you are in the middle, what you can do on the right.
 *
 * The tabs sit here rather than in the layout because all three belong on a
 * single line, and a layout cannot interleave a page's own content into a row
 * it renders itself. Each board supplies its own sides instead.
 *
 * A three-column grid with equal outer tracks, not flex with
 * `justify-between`: the tabs have to be centred on the *panel*, and with flex
 * they would instead be centred on whatever space the two sides happened to
 * leave, drifting every time the count or the buttons changed width.
 *
 * Pins itself directly under the studio chrome — see --studio-chrome-h in
 * globals.css for what that offset is made of. The negative margins let an
 * opaque background reach the panel's edges while the row itself stays aligned
 * with the board's content, so cards scroll under it and not past it.
 */
const BoardHeader = ({ left, right }: { left?: ReactNode; right?: ReactNode }) => (
  <div className="sticky top-[var(--studio-chrome-h)] z-30 -mx-4 mb-6 bg-canvas px-4 py-5 sm:-mx-8 sm:px-8">
    <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-4">
      <div className="flex min-w-0 items-center">{left}</div>

      {/* usePathname is a dynamic API; the fallback renders the same tabs with
          no active state rather than collapsing the row's height. */}
      <Suspense fallback={<StudioTabsList pathname={null} />}>
        <StudioTabs />
      </Suspense>

      <div className="flex min-w-0 items-center justify-end gap-3">{right}</div>
    </div>
  </div>
)

export default BoardHeader
