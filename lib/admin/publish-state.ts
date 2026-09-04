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

/** What the editor should SAY about a project, which is not the same question
 *  `publishState` answers.
 *
 *  There are two independent axes here and conflating them is what made the
 *  studio claim "Live" for projects that were not on the site:
 *
 *    sys.publishedVersion — is this entry published in CONTENTFUL?
 *    fields.published     — should the SITE render it? (getProjects filters
 *                           on exactly this)
 *
 *  `unpublishProject` moves the second one only. It sets `published: false`
 *  and then publishes that change, deliberately, so the entry stays resolvable
 *  by the CDA for anything still linking to it — which means the first axis
 *  still reads "published" and `publishState` still returns 'live'. The pill
 *  was reading that and telling you a hidden project was live.
 *
 *  `publishState` is left alone rather than taught about the flag, because its
 *  other caller — deleteShot, deciding whether a promoted cover needs
 *  republishing — genuinely means the Contentful axis. A hidden project is
 *  still published there and still needs that republish. */
export type VisibleState = PublishState | 'hidden'

export function visibleState(sys: EntrySys, published: boolean): VisibleState {
  const state = publishState(sys)
  // Never published at all: the flag is not the interesting fact yet.
  if (state === 'draft') return 'draft'
  return published ? state : 'hidden'
}

export const VISIBLE_STATE_LABEL: Record<VisibleState, string> = {
  ...PUBLISH_STATE_LABEL,
  hidden: 'Hidden',
}

/** Whether the project is off the public site — the precondition for deleting
 *  it. A draft was never on it; a hidden one has been taken off. */
export function isOffSite(state: VisibleState): boolean {
  return state === 'draft' || state === 'hidden'
}
