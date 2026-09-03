'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useActionState, useState, useTransition } from 'react'
import {
  publishProject,
  saveProject,
  unpublishProject,
  type SaveState,
} from '@/app/admin/actions'
import type { PublishState } from '@/lib/admin/publish-state'
import type { AdminShot } from '@/lib/preview'
import DropZone from './drop-zone'
import ProjectFields, { type ProjectFormValues } from './project-fields'
import ShotCanvas from './shot-canvas'

/**
 * The whole project editor: header, shot canvas, fields.
 *
 * One client component rather than a server page composing three, because the
 * Save/Publish buttons sit in the PAGE HEADER while the inputs they act on are
 * two levels down in the right-hand column. Those buttons need `pending` and
 * the publish transition, so header and form have to share a component — and
 * the header spans the full width, above the columns, so the form element
 * cannot contain it.
 *
 * The buttons reach the form through `form="project-form"` instead: a submit
 * button may live anywhere in the document as long as it names its form. No
 * ref, no synthetic submit, no state lifted any further than it already is.
 */

const initial: SaveState = {}
const FORM_ID = 'project-form'

/* The one non-neutral pair in the system is publish state (see --color-live in
   globals.css), and this is exactly that: Publish is the button whose effect
   reaches the public site, so it is the one that earns the colour. Save draft
   stays neutral because it is the safe action, and Unpublish stays a ghost
   because it should never be the thing your eye lands on first. */
const btn = 'type-button rounded-pill px-4 py-2 transition-opacity disabled:opacity-50'
const primary = `${btn} bg-live text-live-ink hover:opacity-85`
const neutral = `${btn} bg-surface-warm text-ink hover:opacity-85`
const ghost = `${btn} text-muted transition-colors hover:text-ink`

const ProjectEditor = ({
  values,
  state: publish,
  shots,
  coverId,
}: {
  values: ProjectFormValues
  state: PublishState
  shots: AdminShot[]
  coverId?: string
}) => {
  const [state, formAction, pending] = useActionState(saveProject, initial)
  const [busy, startTransition] = useTransition()
  // publishProject returns its failures rather than throwing, so they have to
  // be rendered or a half-finished publish looks exactly like a successful one.
  const [publishError, setPublishError] = useState<string>()
  const isNew = values.id === 'new'

  const run = (fn: (id: string) => Promise<{ error?: string }>) =>
    startTransition(async () => {
      setPublishError(undefined)
      const result = await fn(values.id)
      if (result.error) setPublishError(result.error)
    })

  const header = (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        // /admin, not /admin/projects — the projects board is the studio's
        // index route; there is no page at /admin/projects, only /[id].
        href="/admin"
        aria-label="Back to projects"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-warm text-ink transition-opacity hover:opacity-80"
      >
        <ChevronLeft size={18} />
      </Link>
      <h1 className="type-body min-w-0 truncate font-medium tracking-tight text-ink">
        {isNew ? 'New project' : values.title}
      </h1>

      <div className="ml-auto flex flex-wrap items-center gap-2">
        {state.error && <span className="type-meta text-muted">{state.error}</span>}
        {state.savedAt && !state.error && <span className="type-meta text-muted">Saved.</span>}
        {publishError && <span className="type-meta text-muted">{publishError}</span>}

        <button type="submit" form={FORM_ID} disabled={pending} className={neutral}>
          {pending ? 'Saving…' : 'Save draft'}
        </button>
        {!isNew && (
          <button
            type="button"
            disabled={pending || busy}
            onClick={() => run(publishProject)}
            className={primary}
          >
            {busy ? 'Publishing…' : 'Publish'}
          </button>
        )}
        {!isNew && publish !== 'draft' && (
          <button
            type="button"
            disabled={pending || busy}
            onClick={() => run(unpublishProject)}
            className={ghost}
          >
            Unpublish
          </button>
        )}
      </div>
    </div>
  )

  if (isNew) {
    // One column on purpose: there is nothing to attach shots to until this
    // has been saved, so the canvas and the drop zone would both be dead.
    return (
      <div className="flex flex-col gap-6 pt-6">
        {header}
        <form id={FORM_ID} action={formAction} className="flex max-w-xl flex-col gap-5">
          <ProjectFields values={values} isNew />
        </form>
      </div>
    )
  }

  return (
    /* `main` deliberately has no top padding — the boards' pinned headers
       supply their own. This page has no pinned header, so it supplies it
       here; without it the title sits flush against the panel's nav rule. */
    <div className="flex flex-col gap-6 pt-6">
      {header}

      {/* The work on the left, the controls on the right. A fixed right track
          rather than a fraction: the form's inputs stop being readable much
          past this width, and letting them stretch on a wide monitor would
          take space away from the shot you are actually judging. */}
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_32rem] lg:gap-10">
        <ShotCanvas
          // Keyed on the shot ids so a drop-zone attach remounts it with the
          // new list rather than leaving its local state behind.
          key={shots.map((s) => s.id).join(',')}
          projectId={values.id}
          shots={shots}
          coverId={coverId}
          state={publish}
        />

        <div className="flex flex-col gap-6">
          <DropZone projectId={values.id} />
          {/* No max-width: the grid gives this column a fixed track, so
              constraining it again here would leave a ragged gutter inside its
              own panel. */}
          <form id={FORM_ID} action={formAction} className="flex flex-col gap-5">
            <ProjectFields values={values} isNew={false} />
          </form>
        </div>
      </div>
    </div>
  )
}

export default ProjectEditor
