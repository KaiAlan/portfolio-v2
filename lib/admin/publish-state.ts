/** The three states a Contentful entry can present in the studio.
 *
 *  Contentful keeps a draft and a published version of the same entry, so
 *  "live" and "has unpublished edits" are different things and the studio
 *  must show both — otherwise saving a draft on a live project looks like
 *  it did nothing.
 */
export type PublishState = 'draft' | 'live' | 'live-edited'

export type EntrySys = {
  publishedVersion?: number
  publishedAt?: string
  updatedAt?: string
}

export function publishState(sys: EntrySys): PublishState {
  // The Preview API never returns `version` — it is CMA-only — so state is
  // derived from timestamps instead. Verified against all 30 published
  // fixtures: updatedAt === publishedAt exactly while nothing has been
  // edited since the last publish.
  if (sys.publishedVersion === undefined || !sys.publishedAt) return 'draft'
  return sys.updatedAt && sys.updatedAt > sys.publishedAt ? 'live-edited' : 'live'
}

export const PUBLISH_STATE_LABEL: Record<PublishState, string> = {
  draft: 'Draft',
  live: 'Live',
  'live-edited': 'Live · edited',
}
