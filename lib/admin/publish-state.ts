/** The three states a Contentful entry can present in the studio.
 *
 *  Contentful keeps a draft and a published version of the same entry, so
 *  "live" and "has unpublished edits" are different things and the studio
 *  must show both — otherwise saving a draft on a live project looks like
 *  it did nothing.
 */
export type PublishState = 'draft' | 'live' | 'live-edited'

export type EntrySys = {
  version: number
  publishedVersion?: number
}

export function publishState(sys: EntrySys): PublishState {
  if (sys.publishedVersion === undefined) return 'draft'
  // Publishing bumps `version` one past `publishedVersion`, so equality with
  // publishedVersion + 1 means "nothing changed since publish".
  return sys.version > sys.publishedVersion + 1 ? 'live-edited' : 'live'
}

export const PUBLISH_STATE_LABEL: Record<PublishState, string> = {
  draft: 'Draft',
  live: 'Live',
  'live-edited': 'Live · edited',
}
