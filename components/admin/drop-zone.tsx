'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { addShots } from '@/app/admin/actions'
import { useUploader, type FileStatus } from '@/hooks/use-uploader'

/**
 * The editor's drop zone: upload images, attach them to THIS project.
 *
 * The uploading itself moved to `hooks/use-uploader.ts` when the new-project
 * canvas needed the same engine with a different tail. What is left here is
 * the tail — `addShots` against a project that already exists.
 */

/** The dashed target itself, shared with the new-project canvas so both drop
 *  zones behave identically: click to choose, drop to add, images only.
 *
 *  `accept` filters the picker; the drop path filters again by MIME type,
 *  because a drag carries whatever the OS hands it and `accept` has no say. */
export const DropTarget = ({
  onFiles,
  disabled = false,
  className = 'p-8',
  children,
}: {
  onFiles: (files: File[]) => void
  disabled?: boolean
  className?: string
  children: ReactNode
}) => (
  <label
    onDragOver={(e) => e.preventDefault()}
    onDrop={(e) => {
      e.preventDefault()
      if (disabled) return
      const dropped = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))
      if (dropped.length) onFiles(dropped)
    }}
    className={`flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-card-edge text-center transition-colors hover:border-border-strong ${className}`}
  >
    {children}
    <input
      type="file"
      multiple
      accept="image/*"
      disabled={disabled}
      className="hidden"
      onChange={(e) => {
        const chosen = Array.from(e.target.files ?? [])
        // Cleared so choosing the same file twice in a row still fires change.
        e.target.value = ''
        if (chosen.length) onFiles(chosen)
      }}
    />
  </label>
)

/** Per-file progress. Shared for the same reason DropTarget is. */
export const FileList = ({ files }: { files: FileStatus[] }) =>
  files.length === 0 ? null : (
    <ul className="flex flex-col gap-1">
      {files.map((f, i) => (
        <li key={`${f.name}-${i}`} className="type-meta flex gap-2 text-muted">
          <span className="flex-1 truncate">{f.name}</span>
          <span className="shrink-0">
            {f.status === 'pending' && 'uploading…'}
            {f.status === 'done' && 'done'}
            {f.status === 'failed' && (f.error ?? 'failed')}
          </span>
        </li>
      ))}
    </ul>
  )

const DropZone = ({ projectId }: { projectId: string }) => {
  const { files, upload } = useUploader()
  const [attachError, setAttachError] = useState<string>()
  const [isPending, startTransition] = useTransition()

  const onFiles = async (list: File[]) => {
    setAttachError(undefined)
    const ok = await upload(list)
    if (!ok.length) return

    startTransition(async () => {
      // addShots reports failure rather than throwing; swallowing it would
      // show every file as "done" while nothing attached to the project.
      const result = await addShots(projectId, ok)
      if (result.error) setAttachError(result.error)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <DropTarget onFiles={(l) => void onFiles(l)}>
        <span className="type-body text-muted">Drop images here, or click to choose</span>
      </DropTarget>

      <FileList files={files} />
      {isPending && <span className="type-meta text-muted">Attaching shots…</span>}
      {attachError && <span className="type-meta text-muted">{attachError}</span>}
    </div>
  )
}

export default DropZone
