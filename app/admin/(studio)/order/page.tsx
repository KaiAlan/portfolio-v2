import OrderList from '@/components/admin/order-list'
import { getSettingsEntry, listProjects } from '@/lib/preview'
import { applyOrder } from '@/lib/admin/order'

/** Uncached preview read by design — see the note in the (studio) layout. */
export const instant = false

export default async function OrderPage() {
  const [projects, settings] = await Promise.all([listProjects(), getSettingsEntry()])

  // Only what the feed actually renders. Drafts were never on it and hidden
  // projects have been taken off it, so neither has a position in it anyone
  // can meaningfully decide. `published` is the same field getProjects()
  // filters on, so this list is exactly the feed's.
  const live = projects.filter((p) => p.published && p.state !== 'draft')

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
