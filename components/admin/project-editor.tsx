'use client'

import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useActionState, useEffect, useState, useTransition } from 'react'
import {
  publishProject,
  saveProject,
  unpublishProject,
  type SaveState,
  type UploadedAsset,
} from '@/app/admin/actions'
import { isOffSite, type VisibleState } from '@/lib/admin/publish-state'
import type { AdminShot } from '@/lib/preview'
import DropZone from './drop-zone'
import NewProjectCanvas from './new-project-canvas'
import ProjectFields, { type ProjectFormValues } from './project-fields'
import ShotCanvas from './shot-canvas'
import { Button } from '@/components/ui/button'
import { useToast } from './studio-toaster'
import { useDeleteProject } from './delete-project-provider'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

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
   reaches the public site, so it is the one that earns the colour. Unpublish
   stays a ghost because it should never be the thing your eye lands on first.

   Save draft takes the dark `default` variant rather than the warm-grey
   `secondary` it used to: it is the action you reach for most, and against
   the canvas the warm grey read as disabled next to a tinted Publish. Dark is
   still neutral — it spends no colour, which is the part of the rule that
   matters. Kai's call. */

const ProjectEditor = ({
  values,
  state: publish,
  shots,
  coverId,
}: {
  values: ProjectFormValues
  state: VisibleState
  shots: AdminShot[]
  coverId?: string
}) => {
  const [state, formAction, pending] = useActionState(saveProject, initial)
  const [busy, startTransition] = useTransition()
  // Shots dropped before the project exists. Held here rather than inside the
  // canvas because the FORM needs them too — they ride along as a hidden field
  // so one Save creates the project and attaches them together.
  const [pendingShots, setPendingShots] = useState<UploadedAsset[]>([])
  // Deleting is two clicks on purpose: the button arms a confirmation dialog
  // rather than doing anything. Nothing here is undoable.
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const isNew = values.id === 'new'

  // Delete is offered only once the project is off the site — a draft, or one
  // that has been unpublished. The action re-checks this server-side; this
  // only decides whether the button is on screen.
  const canDelete = !isNew && isOffSite(publish)

  const { toast } = useToast()

  /* The delete is dispatched from the studio LAYOUT, not from here — see
     DeleteProjectProvider. It runs for 15-20 seconds and this page is one you
     can leave; owning the action here meant leaving mid-delete threw the
     result away, so the project went but nothing ever said so. All this
     component keeps is whether the project it is showing is the one going. */
  const { requestDelete, deletingId } = useDeleteProject()
  const deleting = deletingId === values.id

  // Save reports through the same channel as everything else now. It used to
  // leave a line of muted 12px text beside a button you had already looked
  // away from, which is the reason none of this was ever noticed failing.
  useEffect(() => {
    if (state.error) toast(state.error, 'danger')
    else if (state.savedAt) toast('Draft saved.')
  }, [state, toast])

  // publishProject returns its failures rather than throwing, so they have to
  // be surfaced or a half-finished publish looks exactly like a successful one.
  const run = (fn: (id: string) => Promise<{ error?: string }>, done: string) =>
    startTransition(async () => {
      const result = await fn(values.id)
      if (result.error) toast(result.error, 'danger')
      else toast(done)
    })

  /* Pinned, on the same offset and with the same negative-margin trick the
     boards' BoardHeader uses — see the note there. The editor is the one
     studio page tall enough to scroll a long way (a canvas, a strip, and a
     dozen fields), and it was the one page where Save and Publish scrolled
     away with it. Nothing about the row changes; only where it sits.

     `py-5` rather than the wrapper's old `pt-6`: the padding has to belong to
     the pinned row, or it sits above it and scrolls off. */
  const header = (
    <div className="sticky top-[var(--studio-chrome-h)] z-30 -mx-4 flex flex-wrap items-center gap-3 bg-canvas px-4 py-5 sm:-mx-8 sm:px-8">
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

      {/* No status text in the row any more — every one of these actions
          reports as a toast now, which is both further from the button you
          stopped looking at and closer to where your eye actually goes. */}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <Button type="submit" form={FORM_ID} disabled={pending}>
          {pending ? 'Saving…' : 'Save draft'}
        </Button>
        {!isNew && (
          <Button
            type="button"
            disabled={pending || busy}
            onClick={() => run(publishProject, 'Published to the site.')}
            variant="live"
          >
            Publish
          </Button>
        )}
        {!isNew && !isOffSite(publish) && (
          <Button
            type="button"
            disabled={pending || busy}
            onClick={() => run(unpublishProject, 'Taken off the site.')}
            variant="ghost"
          >
            Unpublish
          </Button>
        )}
        {/* The only control that reflects a delete in flight. Everything else
            stays live: you asked for it, it is running, and there is no reason
            you cannot keep working while it does. */}
        {canDelete && (
          <Button
            type="button"
            disabled={pending || busy || deleting}
            onClick={() => setConfirmingDelete(true)}
            variant="danger"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        )}
      </div>
    </div>
  )

  /* An actual modal dialog, not a browser confirm(): it has to name what is
     about to be destroyed, and a native dialog cannot. Same call shot-canvas
     makes for deleting a shot, one level up — and the counts come from the
     shots this editor already has in hand, so the number you read is the
     number that goes.

     Radix's ALERT dialog specifically — see components/ui/alert-dialog.tsx —
     so a misclick on the editor behind it can never dismiss it; only Cancel,
     Escape, or the delete itself can.

     Controlled, not left to the trigger, because confirming has to close it
     immediately — see below. */
  const confirmDialog = (
    <AlertDialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete “{values.title || 'this project'}”?</AlertDialogTitle>
          <AlertDialogDescription>
            The project
            {shots.length > 0 && `, its ${shots.length} ${shots.length === 1 ? 'shot' : 'shots'}`}
            {shots.length > 0 && ' and their images'} will be removed from Contentful for good.
            There is no undo.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          {/* Confirming closes the dialog on the spot and lets the delete run
              behind you — a Contentful round trip over several shots takes
              seconds, and a modal is the wrong place to spend them. The
              outcome arrives as a toast either way: the success case redirects
              to the board and toasts there, a failure toasts here.

              The action it fires lives in the layout, so neither closing this
              dialog nor leaving the page can cut the delete's report short.

              Danger tone on the confirming action only, the same reasoning the
              old inline panel carried: nothing here should read as the default
              choice. */}
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setConfirmingDelete(false)
              requestDelete(values.id)
            }}
          >
            Delete permanently
          </Button>
          <AlertDialogCancel asChild>
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
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
      <div className="flex flex-col gap-6">
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
       supply their own, and this page's header is now one of them, so its
       `py-5` is the padding. Putting it back on the wrapper would place it
       ABOVE the pinned row, where it scrolls away and lets the title ride up
       against the panel's nav rule. */
    <div className="flex flex-col gap-6">
      {header}
      {confirmDialog}

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
