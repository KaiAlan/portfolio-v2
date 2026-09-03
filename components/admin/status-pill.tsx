import { PUBLISH_STATE_LABEL, type PublishState } from '@/lib/admin/publish-state'

const TONE: Record<PublishState, string> = {
  draft: 'bg-surface-warm text-muted',
  live: 'bg-surface-warm text-ink',
  'live-edited': 'bg-surface-warm text-ink',
}

const StatusPill = ({ state }: { state: PublishState }) => (
  <span className={`type-meta rounded-pill px-2 py-0.5 ${TONE[state]}`}>
    {state === 'live-edited' && <span aria-hidden className="mr-1">•</span>}
    {PUBLISH_STATE_LABEL[state]}
  </span>
)

export default StatusPill
