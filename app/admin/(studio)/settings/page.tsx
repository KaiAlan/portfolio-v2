import BoardHeader from '@/components/admin/board-header'
import DefaultViewField from '@/components/admin/default-view-field'
import PlaylistField from '@/components/admin/playlist-field'
import { getSettingsEntry } from '@/lib/preview'
import {
  FEED_FALLBACK,
  isFeedColumnChoice,
  isFeedMode,
  type FeedDefaults,
} from '@/lib/types'

/** Uncached preview read by design — see the note in the (studio) layout. */
export const instant = false

/**
 * Settings — the site-wide switches that aren't about one project.
 *
 * This was the Music board until 2026-09-04. Music was never really its own
 * section, it was the only setting that existed; a second one (the feed's
 * default layout) made "Music" the wrong name for the tab rather than the
 * wrong place for the field. Both live on `siteSettings` and save the same
 * way, so they belong together.
 *
 * Each field saves independently and explicitly. Writing to siteSettings
 * republishes the entry and waits for delivery, which is not something to
 * fire on a keystroke — see savePlaylist in app/admin/actions.ts.
 */
export default async function AdminSettingsPage() {
  const settings = await getSettingsEntry()

  const playlistId =
    typeof settings?.fields.youtubePlaylistId === 'string'
      ? settings.fields.youtubePlaylistId
      : ''

  // Same fallback the public mapper applies (lib/contentful.ts): an entry
  // predating these fields shows the defaults rather than an empty control.
  const feedDefaults: FeedDefaults = {
    mode: isFeedMode(settings?.fields.defaultFeedView)
      ? settings.fields.defaultFeedView
      : FEED_FALLBACK.mode,
    columns: isFeedColumnChoice(settings?.fields.defaultFeedColumns)
      ? (settings?.fields.defaultFeedColumns as number)
      : FEED_FALLBACK.columns,
  }

  return (
    <>
      <BoardHeader />
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-10 py-4">
        <DefaultViewField initial={feedDefaults} />
        <PlaylistField initial={playlistId} />
      </div>
    </>
  )
}
