import OrderList from '@/components/admin/order-list'
import { getSettingsEntry, listProjects } from '@/lib/preview'
import { applyOrder } from '@/lib/admin/order'

/** Uncached preview read by design — see the note in the (studio) layout. */
export const instant = false

export default async function OrderPage() {
  const [projects, settings] = await Promise.all([listProjects(), getSettingsEntry()])

  // Drafts are excluded: they are not in the feed, so their position in it is
  // not yet a decision anyone can make.
  const live = projects.filter((p) => p.state !== 'draft')

  // listProjects() returns newest-first. Showing that while the feed serves
  // the saved order would make the panel disagree with the thing it edits, so
  // the same ordering the site applies is applied here.
  const order = Array.isArray(settings?.fields.projectOrder)
    ? (settings.fields.projectOrder as string[])
    : []

  // No heading: the active tab above already names this board, and the
  // instruction that used to sit under it now rides with the Save button,
  // where the action it describes actually is.
  return <OrderList projects={applyOrder(live, order)} />
}
