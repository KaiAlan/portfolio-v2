'use client'

import { useState, useTransition } from 'react'
import { savePlaylist } from '@/app/admin/actions'
import { Button } from '@/components/ui/button'

/**
 * Sets the playlist behind the nav music player.
 *
 * Takes a pasted YouTube link as readily as a bare id — copying the address
 * bar mid-playlist gives `watch?v=…&list=…`, and asking anyone to dig the id
 * out of that by hand is a chore the parser can do instead.
 *
 * Explicit save, like the order board above it: this writes to siteSettings
 * and republishes, which is not something to fire on every keystroke.
 */
const PlaylistField = ({ initial }: { initial: string }) => {
  const [value, setValue] = useState(initial)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string>()
  const [isPending, startTransition] = useTransition()

  const dirty = value.trim() !== initial.trim()

  const save = () => {
    setError(undefined)
    startTransition(async () => {
      const result = await savePlaylist(value)
      if (result.error) {
        setError(result.error)
        return
      }
      setSaved(true)
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-1">
        <label htmlFor="playlist" className="type-meta text-ink">
          Music
        </label>
        <p className="type-meta text-muted-soft">
          The YouTube playlist behind the player in the header. Paste a link or an id.
          Add, remove and reorder the songs on YouTube itself. Leave it empty to
          hide the player.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="playlist"
          value={value}
          onChange={(event) => {
            setValue(event.target.value)
            setSaved(false)
            setError(undefined)
          }}
          placeholder="https://www.youtube.com/playlist?list=…"
          className="type-meta w-full max-w-lg rounded-pill bg-control px-4 py-2 text-ink outline-none placeholder:text-muted-soft"
        />
        <Button
          type="button"
          disabled={!dirty || isPending}
          onClick={save}
          className="whitespace-nowrap"
        >
          {isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      {saved && <span className="type-meta text-muted">Saved.</span>}
      {error && <span className="type-meta text-muted">{error}</span>}
    </div>
  )
}

export default PlaylistField
