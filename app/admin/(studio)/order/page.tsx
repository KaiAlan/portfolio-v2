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

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="type-body font-medium tracking-tight text-ink">Order</h1>
        <p className="type-meta text-muted">
          Drag to arrange the feed. Drafts are not shown — they have no place in it yet.
        </p>
      </div>
      <OrderList projects={applyOrder(live, order)} />
    </div>
  )
}
