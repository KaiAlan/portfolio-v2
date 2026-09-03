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

/** Converts a drop *gap* into the index `moveItem` should land the card at.
 *
 *  A gap is counted between cards — 0 is before the first, `length` is after
 *  the last — which is what a drop caret actually points at. `moveItem` instead
 *  takes the index the card ends up occupying, and since it removes the card
 *  before re-inserting it, every gap after the card's own position shifts down
 *  by one. That shift is the entire conversion, and it is the easiest thing
 *  here to get wrong by one.
 *
 *  Returns null when the drop would not move anything: both gaps either side
 *  of a card put it straight back where it was. */
export function targetForInsertion(from: number, insertion: number): number | null {
  const to = insertion > from ? insertion - 1 : insertion
  return to === from ? null : to
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
