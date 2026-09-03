/** Removing a shot from a project — the pure half.
 *
 *  Split out of the server action for the same reason lib/admin/order.ts is:
 *  the part worth pinning down is the cover promotion, and that is decidable
 *  from three arguments without touching Contentful. The action keeps the
 *  network walk; this keeps the rule.
 *
 *  The client uses it too, so the optimistic list a delete paints on screen is
 *  produced by the same function the server writes with — the two cannot
 *  disagree about which shot becomes the cover.
 */

export type ShotRemoval<T> = {
  shots: T[]
  /** The cover after the removal. `null` means the project has none left. */
  coverId: string | null
  /** Whether `coverShot` needs writing at all — see below. */
  coverChanged: boolean
  /** False when `shotId` was not in the list, which means a stale caller. */
  removed: boolean
}

/**
 * `coverChanged` is the load-bearing return value, not a convenience.
 *
 * updateEntry MERGES, so `undefined` leaves a field alone and `null` clears it
 * (the convention lib/cma.ts documents). A caller that always wrote
 * `coverShot` would republish an identical cover on every delete; one that
 * never wrote it would leave the project pointing at a deleted entry. The flag
 * is how the action tells those two apart.
 *
 * A cover that isn't in `shots` at all is left exactly as it is. `coverShot`
 * is an independent reference field and can legitimately dangle; silently
 * "fixing" it during an unrelated delete would push a cover change nobody
 * asked for onto the live site.
 */
export function removeShot<T extends { id: string }>(
  shots: T[],
  coverId: string | undefined,
  shotId: string,
): ShotRemoval<T> {
  const next = shots.filter((shot) => shot.id !== shotId)
  const removed = next.length !== shots.length

  if (!removed || coverId !== shotId) {
    return { shots: next, coverId: coverId ?? null, coverChanged: false, removed }
  }

  // The cover went with it. The first remaining shot takes over — the one the
  // site would lead with anyway — and an empty project ends up with no cover,
  // which Contentful will refuse to publish until another shot is added.
  return { shots: next, coverId: next[0]?.id ?? null, coverChanged: true, removed }
}
