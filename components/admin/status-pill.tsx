import { PUBLISH_STATE_LABEL, type PublishState } from '@/lib/admin/publish-state'

/** Live is the only state that gets colour — see the token comment in
 *  globals.css. A draft is a neutral pill because "not yet live" is the
 *  absence of a fact, not one worth flagging; `live-edited` keeps the mint
 *  (it *is* live) and earns its dot to say the served version is behind. */
const TONE: Record<PublishState, string> = {
  draft: 'bg-surface-warm text-muted',
  live: 'bg-live text-live-ink',
  'live-edited': 'bg-live text-live-ink',
}

const StatusPill = ({ state }: { state: PublishState }) => (
  <span className={`type-meta rounded-pill px-3 py-1 whitespace-nowrap ${TONE[state]}`}>
    {state === 'live-edited' && <span aria-hidden className="mr-1">•</span>}
    {PUBLISH_STATE_LABEL[state]}
  </span>
)

export default StatusPill
