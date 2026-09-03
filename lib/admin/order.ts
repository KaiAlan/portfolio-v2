/** Reordering writes ONE array of entity IDs to siteSettings — never a
 *  per-entry order field, which would be 80 writes instead of 1.
 *  IDs, not slugs: a slug rename must not silently drop a project to the end. */

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items]
  if (from < 0 || from >= items.length || to < 0 || to >= items.length) return next
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

export function toIdArray<T extends { id: string }>(items: T[]): string[] {
  return items.map((item) => item.id)
}

/** Applies a saved `projectOrder` to a list of entities.
 *
 *  This mirrors the private applyOrder in lib/contentful.ts, which is the
 *  public read path and must stay byte-for-byte as it is. The order panel has
 *  to sort by exactly the same rule the site does — otherwise it shows one
 *  sequence, saves it, and the feed serves another — so the rule is restated
 *  here rather than reached for across that boundary. Keep the two in step.
 *
 *  Unlisted ids rank last, and Array.prototype.sort is stable, so items the
 *  order does not mention keep the order they arrived in. */
export function applyOrder<T extends { id: string }>(items: T[], order: string[]): T[] {
  if (!order.length) return items
  const rank = new Map(order.map((id, i) => [id, i]))
  return [...items].sort((a, b) => {
    const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER
    const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER
    return ra - rb
  })
}
