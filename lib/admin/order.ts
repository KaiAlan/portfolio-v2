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
