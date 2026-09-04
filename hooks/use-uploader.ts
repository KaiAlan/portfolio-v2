'use client'

import { useCallback, useRef, useState } from 'react'
import type { UploadedAsset } from '@/app/admin/actions'

/**
 * Uploads dropped files to Contentful and reports per-file progress.
 *
 * Extracted from `drop-zone.tsx` because there are now two callers that need
 * the same engine and disagree about what happens NEXT: the project editor
 * attaches the results to a project immediately, while the new-project canvas
 * has no project to attach to yet and holds them until Save. Only the tail
 * differs, so only the tail lives in the components.
 *
 * Uploading is entirely independent of any project — the route creates and
 * publishes an asset and nothing else — which is what makes the new-project
 * flow possible at all.
 */

export type FileStatus = {
  name: string
  status: 'pending' | 'done' | 'failed'
  error?: string
}

/** Cap on in-flight uploads. The CMA allows 7 req/s and each file costs
 *  several calls, so more workers here buys rate-limit errors, not speed. */
const CONCURRENCY = 3

export function useUploader() {
  const [files, setFiles] = useState<FileStatus[]>([])
  const [uploading, setUploading] = useState(false)
  // Guards against a second drop landing while the first is still running,
  // which would reset `files` out from under the workers still writing to it.
  const busy = useRef(false)

  const reset = useCallback(() => setFiles([]), [])

  const upload = useCallback(async (list: File[]): Promise<UploadedAsset[]> => {
    if (busy.current || list.length === 0) return []
    busy.current = true
    setUploading(true)
    setFiles(list.map((f) => ({ name: f.name, status: 'pending' })))

    // Written BY INDEX, not pushed: workers finish out of order, and pushing
    // would return the assets in completion order rather than the order they
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

    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, list.length) }, worker))

    busy.current = false
    setUploading(false)

    // Successes are kept even when some files failed — never make the editor
    // re-drop 18 good files because 2 broke. The gaps are simply skipped, so
    // the survivors keep their relative order.
    return uploaded.filter((a): a is UploadedAsset => a !== undefined)
  }, [])

  return { files, uploading, upload, reset }
}
