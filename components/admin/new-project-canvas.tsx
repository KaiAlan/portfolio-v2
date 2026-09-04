'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { createProjectsFromAssets, discardAssets, type UploadedAsset } from '@/app/admin/actions'
import { useUploader } from '@/hooks/use-uploader'
import { planProjects } from '@/lib/admin/bulk'
import { moveItem } from '@/lib/admin/order'
import { imageUrl } from '@/lib/media'
import type { AdminShot } from '@/lib/preview'
import { DropTarget, FileList } from './drop-zone'
import ShotsStrip from './shots-strip'
import { Button } from '@/components/ui/button'

/**
 * The new-project page's right-hand column.
 *
 * The editor's ShotCanvas cannot be reused here, and the reason is structural
 * rather than cosmetic: every one of its actions takes a `projectId`, and on
 * this page there is no project yet. Files are uploaded as soon as they are
 * dropped — the upload route needs no project, and it has to run early because
 * it is what validates the image — but nothing can be LINKED until Save
 * creates the entry. So this component holds the assets in local state and
 * hands them to the form.
 *
 * `shots-strip.tsx` IS reused as-is. It was already controlled and purely
 * presentational, so it does not care that these shots have no server behind
 * them; every callback is local here where ShotCanvas's are server actions.
 *
 * Four states, in order:
 *   idle      nothing dropped yet — the drop target fills the hero box
 *   choosing  files uploaded, waiting on one-project-or-many
 *   shots     one project: hero + strip, exactly like the editor
 *   bulk      many projects: the planned titles and slugs, then Create
 */

/** The pending shots' cover is simply the FIRST one, because that is what
 *  `saveProject` writes (`coverShot: shots[0]`). Tracking a separate cover id
 *  here would let the screen and the save disagree; "set as cover" moves the
 *  shot to the front instead, which is the same fact expressed once. */
const asShots = (assets: UploadedAsset[]): AdminShot[] =>
  assets.map((a) => ({
    id: a.assetId,
    url: imageUrl(a.url, 240),
    previewUrl: imageUrl(a.url, 1200),
    width: a.width,
    height: a.height,
  }))

const heroBox =
  'relative flex h-[var(--studio-hero-h)] min-h-[240px] items-center justify-center ' +
  'overflow-hidden rounded-card bg-surface-alt p-3'

const NewProjectCanvas = ({
  formId,
  assets,
  onAssetsChange,
}: {
  /** The fields form, read at click time for the bulk category and Featured.
   *  Those inputs are uncontrolled (`defaultValue` throughout), so reading the
   *  form when the button is pressed is the intended mechanism here — the same
   *  reason the page header's buttons reach it with `form=` rather than state. */
  formId: string
  assets: UploadedAsset[]
  onAssetsChange: (next: UploadedAsset[]) => void
}) => {
  const router = useRouter()
  const { files, uploading, upload, reset } = useUploader()
  const [mode, setMode] = useState<'choosing' | 'one' | 'many'>('choosing')
  const [selectedId, setSelectedId] = useState<string>()
  const [error, setError] = useState<string>()
  const [failures, setFailures] = useState<string[]>([])
  const [creating, startCreating] = useTransition()

  const shots = asShots(assets)
  const selected = shots.find((s) => s.id === selectedId) ?? shots[0]

  const onFiles = async (list: File[]) => {
    setError(undefined)
    const ok = await upload(list)
    if (!ok.length) return
    // Appended, so a second drop adds to the set rather than replacing it.
    onAssetsChange([...assets, ...ok])
    setMode('choosing')
  }

  const remove = (assetId: string) => {
    onAssetsChange(assets.filter((a) => a.assetId !== assetId))
    // The asset is already in Contentful (see discardAssets); dropping it from
    // this array alone would leave it there with nothing pointing at it.
    void discardAssets([assetId])
  }

  const createMany = () => {
    const form = document.getElementById(formId) as HTMLFormElement | null
    const data = new FormData(form ?? undefined)
    const category = String(data.get('category') ?? '')
    const featured = data.get('featured') === 'on'

    setError(undefined)
    setFailures([])
    startCreating(async () => {
      const result = await createProjectsFromAssets(assets, category, featured)
      if (result.error) {
        setError(result.error)
        return
      }
      setFailures(result.failed)
      if (result.failed.length === 0) {
        // Everything landed — the board is where you go to edit them.
        router.push('/admin')
      } else {
        // Some failed. Keep the page up with the list rather than navigating
        // away from the only place the failures are named; drop the ones that
        // succeeded so a retry cannot create them twice.
        onAssetsChange([])
      }
    })
  }

  /* ---- idle: nothing dropped yet ------------------------------------- */
  if (assets.length === 0) {
    return (
      <div className="flex flex-col gap-3">
        <DropTarget
          onFiles={(l) => void onFiles(l)}
          disabled={uploading}
          className={`${heroBox} border border-dashed bg-surface-alt`}
        >
          <span className="type-body max-w-xs text-muted">
            {uploading ? 'Uploading…' : 'Drop images here, or click to choose'}
            {!uploading && (
              <span className="type-meta mt-1 block text-muted-soft">
                One project with many shots, or one project per image — you choose after.
              </span>
            )}
          </span>
        </DropTarget>
        <FileList files={files} />
        {error && <span className="type-meta text-muted">{error}</span>}
        {failures.length > 0 && (
          <ul className="flex flex-col gap-1">
            {failures.map((f) => (
              <li key={f} className="type-meta text-muted">{f}</li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  /* ---- choosing: what should these files become? --------------------- */
  if (mode === 'choosing') {
    const planned = planProjects(assets.map((a) => a.name), [])
    return (
      <div className="flex flex-col gap-3">
        <div className={heroBox}>
          <div className="flex max-w-sm flex-col items-center gap-4">
            <p className="type-body text-ink">
              {assets.length} {assets.length === 1 ? 'image' : 'images'} uploaded. What are they?
            </p>
            <div className="flex flex-col gap-2 self-stretch">
              <Button type="button" onClick={() => setMode('one')} className="w-full">
                One project with {assets.length} {assets.length === 1 ? 'shot' : 'shots'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setMode('many')}
                className="w-full"
              >
                {assets.length} {assets.length === 1 ? 'project' : 'projects'}, one per image
              </Button>
            </div>
            {/* Named up front, because the two paths differ in what happens to
                the fields on the left — and that is not recoverable by undo. */}
            <p className="type-meta text-center text-muted-soft">
              {planned.length > 1
                ? `Titled from the filenames — “${planned[0].title}”, “${planned[1].title}”…`
                : `Titled from the filename — “${planned[0].title}”`}
            </p>
          </div>
        </div>
        <FileList files={files} />
      </div>
    )
  }

  /* ---- many: one project per image ----------------------------------- */
  if (mode === 'many') {
    const planned = planProjects(assets.map((a) => a.name), [])
    return (
      <div className="flex flex-col gap-3">
        <div className="flex h-[var(--studio-hero-h)] min-h-[240px] flex-col overflow-y-auto rounded-card bg-surface-alt p-4">
          <p className="type-meta shrink-0 pb-3 text-muted">
            Each becomes a draft with one shot. Category and Featured come from the form on the
            left; everything else you fill in per project afterwards.
          </p>
          <ul className="flex flex-col gap-1">
            {planned.map((p, i) => (
              <li
                key={p.slug}
                className="flex items-center gap-3 rounded-card bg-canvas px-3 py-2"
              >
                <img
                  src={imageUrl(assets[i].url, 96)}
                  alt=""
                  className="size-9 shrink-0 rounded-card object-cover"
                />
                <span className="type-body min-w-0 flex-1 truncate text-ink">{p.title}</span>
                <span className="type-meta shrink-0 text-muted-soft">/{p.slug}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" disabled={creating} onClick={createMany}>
            {creating ? 'Creating…' : `Create ${planned.length} drafts`}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMode('choosing')}>
            Back
          </Button>
          {/* Slugs are checked against the whole space when the action runs, so
              a suffix can still appear that this preview did not show. */}
          <span className="type-meta text-muted-soft">
            Slugs are finalised against existing projects when you create.
          </span>
        </div>

        {error && <span className="type-meta text-muted">{error}</span>}
        {failures.length > 0 && (
          <ul className="flex flex-col gap-1">
            {failures.map((f) => (
              <li key={f} className="type-meta text-muted">{f}</li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  /* ---- one: hero + strip, as the editor does it ---------------------- */
  return (
    <div className="flex flex-col gap-3">
      <div className={heroBox}>
        {selected ? (
          <img
            src={selected.previewUrl}
            alt=""
            className="max-h-full max-w-full rounded-card object-contain"
          />
        ) : (
          <span className="type-meta text-muted-soft">No shots yet</span>
        )}
      </div>

      <span className="type-meta shrink-0 text-muted">
        Drag to reorder · click to preview · the first shot is the cover. Nothing is saved until
        you press Save draft.
      </span>

      <ShotsStrip
        shots={shots}
        selectedId={selected?.id}
        coverId={shots[0]?.id}
        onSelect={setSelectedId}
        onReorder={(from, to) => onAssetsChange(moveItem(assets, from, to))}
        onSetCover={(id) => {
          const at = assets.findIndex((a) => a.assetId === id)
          if (at > 0) onAssetsChange(moveItem(assets, at, 0))
        }}
        onDelete={remove}
      />

      <div className="flex flex-wrap items-center gap-3">
        <DropTarget onFiles={(l) => void onFiles(l)} disabled={uploading} className="px-4 py-2">
          <span className="type-meta text-muted">{uploading ? 'Uploading…' : 'Add more'}</span>
        </DropTarget>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            void discardAssets(assets.map((a) => a.assetId))
            onAssetsChange([])
            reset()
            setMode('choosing')
          }}
        >
          Clear
        </Button>
      </div>

      <FileList files={files} />
      {error && <span className="type-meta text-muted">{error}</span>}
    </div>
  )
}

export default NewProjectCanvas
