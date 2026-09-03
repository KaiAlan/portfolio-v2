import BoardHeader from '@/components/admin/board-header'

/** Uncached preview read by design — see the note in the (studio) layout.
 *  Set now even though this board reads nothing yet, so that wiring the
 *  shopItem list in doesn't quietly reintroduce the instant-validation warning
 *  the other two boards already had to silence. */
export const instant = false

/**
 * Shop — deliberately a stub.
 *
 * The tab exists because the studio's navigation shouldn't grow a hole later,
 * but shop items are still edited in Contentful directly. Managing them here
 * is its own task: `shopItem` needs the same form, upload and publish walk
 * that projects got, and none of that is a restyle.
 */
export default function AdminShopPage() {
  return (
    <>
      <BoardHeader />
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <p className="type-body text-muted">Nothing to edit here yet.</p>
        <p className="type-meta max-w-sm text-muted-soft">
          Shop items still live in Contentful. This board gets the same form and
          upload flow the projects board has — it just hasn&rsquo;t been built.
        </p>
      </div>
    </>
  )
}
