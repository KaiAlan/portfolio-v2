import BoardHeader from '@/components/admin/board-header'
import PlaylistField from '@/components/admin/playlist-field'
import { getSettingsEntry } from '@/lib/preview'

/** Uncached preview read by design — see the note in the (studio) layout. */
export const instant = false

/**
 * Music — the playlist behind the header player, and nothing else.
 *
 * Its own board rather than a section under Order, where it first lived: a
 * setting parked below an unrelated drag-and-drop board is a setting nobody
 * finds. The individual songs are not here on purpose — they are the YouTube
 * playlist's contents, edited on YouTube, and mirroring them into a second
 * place to manage would be two sources of truth for one list.
 */
export default async function AdminMusicPage() {
  const settings = await getSettingsEntry()
  const playlistId =
    typeof settings?.fields.youtubePlaylistId === 'string' ? settings.fields.youtubePlaylistId : ''

  return (
    <>
      <BoardHeader />
      <div className="mx-auto w-full max-w-2xl py-4">
        <PlaylistField initial={playlistId} />
      </div>
    </>
  )
}
