'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useActionState, useState, useTransition } from 'react'
import {
  publishProject,
  saveProject,
  unpublishProject,
  type SaveState,
  type UploadedAsset,
} from '@/app/admin/actions'
import type { PublishState } from '@/lib/admin/publish-state'
import type { AdminShot } from '@/lib/preview'
import DropZone from './drop-zone'
import NewProjectCanvas from './new-project-canvas'
import ProjectFields, { type ProjectFormValues } from './project-fields'
import ShotCanvas from './shot-canvas'
import { Button } from '@/components/ui/button'

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
/* Variants now, not hand-rolled class strings — but the same three roles and
   the same reasoning. `live` exists purely for Publish. */

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
  // Shots dropped before the project exists. Held here rather than inside the
  // canvas because the FORM needs them too — they ride along as a hidden field
  // so one Save creates the project and attaches them together.
  const [pendingShots, setPendingShots] = useState<UploadedAsset[]>([])
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

        <Button type="submit" form={FORM_ID} disabled={pending} variant="secondary">
          {pending ? 'Saving…' : 'Save draft'}
        </Button>
        {!isNew && (
          <Button
            type="button"
            disabled={pending || busy}
            onClick={() => run(publishProject)}
            variant="live"
          >
            {busy ? 'Publishing…' : 'Publish'}
          </Button>
        )}
        {!isNew && publish !== 'draft' && (
          <Button
            type="button"
            disabled={pending || busy}
            onClick={() => run(unpublishProject)}
            variant="ghost"
          >
            Unpublish
          </Button>
        )}
      </div>
    </div>
  )

  if (isNew) {
    /* Two columns, MIRRORED from the editor below: fields left, canvas right.
       Deliberate, and worth knowing before you "fix" it — saving redirects
       into the editor, where the canvas is on the left, so the work visibly
       swaps sides at that moment. That was Kai's call; the alternative was
       matching the editor here and leaving this page's empty half on the
       right, which is where the eye already is when you start typing.

       No max-w on the form any more. The grid track sets its width now, and
       constraining it again would leave a ragged gutter inside its own
       column — the same note the editor's right column carries. */
    return (
      <div className="flex flex-col gap-6 pt-6">
        {header}

        <div className="grid gap-8 lg:grid-cols-[32rem_minmax(0,1fr)] lg:gap-10">
          <form id={FORM_ID} action={formAction} className="flex flex-col gap-5">
            <ProjectFields values={values} isNew />
            {/* The shots are already uploaded as Contentful ASSETS by the time
                this submits; what they are not yet is linked to anything. This
                carries them into the same action that creates the project, so
                one Save both creates it and attaches them — see saveProject. */}
            <input type="hidden" name="pendingAssets" value={JSON.stringify(pendingShots)} />
          </form>

          <NewProjectCanvas formId={FORM_ID} assets={pendingShots} onAssetsChange={setPendingShots} />
        </div>
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
