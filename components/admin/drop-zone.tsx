'use client'

import { useState, useTransition } from 'react'
import { addShots, type UploadedAsset } from '@/app/admin/actions'

type FileState = { name: string; status: 'pending' | 'done' | 'failed'; error?: string }

const CONCURRENCY = 3

const DropZone = ({ projectId }: { projectId: string }) => {
  const [files, setFiles] = useState<FileState[]>([])
  const [attachError, setAttachError] = useState<string>()
  const [isPending, startTransition] = useTransition()

  const upload = async (list: File[]) => {
    setFiles(list.map((f) => ({ name: f.name, status: 'pending' })))
    setAttachError(undefined)

    // Written BY INDEX, not pushed: workers finish out of order, and pushing
    // would attach the shots in completion order rather than the order they
    // were dropped. Same reason lib/admin/pool.ts indexes its results.
    const uploaded = new Array<UploadedAsset | undefined>(list.length)

    let cursor = 0
    const worker = async () => {
      while (cursor < list.length) {
        const index = cursor++
        const file = list[index]
        const body = new FormData()
        body.append('file', file)
        try {
          const res = await fetch('/api/admin/upload', { method: 'POST', body })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error ?? 'Upload failed')
          uploaded[index] = json
          setFiles((prev) => prev.map((f, i) => (i === index ? { ...f, status: 'done' } : f)))
        } catch (error) {
          setFiles((prev) =>
            prev.map((f, i) =>
              i === index ? { ...f, status: 'failed', error: (error as Error).message } : f,
            ),
          )
        }
      }
    }

    // Cap in-flight uploads: the CMA allows 7 req/s and each file is several calls.
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker))

    // Successes are kept even when some files failed — never make the user
    // re-drop 18 good files because 2 broke. The gaps are simply skipped, so
    // the survivors keep their relative order.
    const ok = uploaded.filter((a): a is UploadedAsset => a !== undefined)
    if (ok.length) {
      startTransition(async () => {
        // addShots reports failure rather than throwing; swallowing it would
        // show every file as "done" while nothing attached to the project.
        const result = await addShots(projectId, ok)
        if (result.error) setAttachError(result.error)
      })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <label
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          const dropped = Array.from(e.dataTransfer.files).filter((f) =>
            f.type.startsWith('image/'),
          )
          if (dropped.length) void upload(dropped)
        }}
        className="flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-card-edge p-8"
      >
        <span className="type-body text-muted">Drop images here, or click to choose</span>
        <input
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const chosen = Array.from(e.target.files ?? [])
            if (chosen.length) void upload(chosen)
          }}
        />
      </label>

      {files.length > 0 && (
        <ul className="flex flex-col gap-1">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="type-meta flex gap-2 text-muted">
              <span className="flex-1 truncate">{f.name}</span>
              <span>
                {f.status === 'pending' && 'uploading…'}
                {f.status === 'done' && 'done'}
                {f.status === 'failed' && (f.error ?? 'failed')}
              </span>
            </li>
          ))}
        </ul>
      )}
      {isPending && <span className="type-meta text-muted">Attaching shots…</span>}
      {attachError && <span className="type-meta text-muted">{attachError}</span>}
    </div>
  )
}

export default DropZone
