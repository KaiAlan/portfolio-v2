/** Reading a YouTube playlist id out of whatever gets pasted into the studio. */

/** YouTube playlist ids: PL…, UU…, FL…, OL…, RD…, plus the LL/WL specials.
 *  Deliberately loose on length — YouTube has changed it before. */
const ID_PATTERN = /^[A-Za-z0-9_-]{2,}$/
const HOSTS = ['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be', 'music.youtube.com']

/**
 * Accepts a bare id or any YouTube URL carrying `list=`, and returns the id.
 *
 * A watch URL is the likeliest paste — copying the address bar while a
 * playlist plays gives `watch?v=…&list=…`, not the clean playlist link.
 *
 * Returns null for anything else, including a video URL with no list on it:
 * accepting that silently would build a player that loads nothing and gives
 * no reason why.
 */
export function parsePlaylistId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (!trimmed.includes('/') && !trimmed.includes('?')) {
    return ID_PATTERN.test(trimmed) ? trimmed : null
  }

  // Tolerate a missing scheme — "youtube.com/playlist?list=…" is a normal paste.
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(withScheme)
  } catch {
    return null
  }

  if (!HOSTS.includes(url.hostname.toLowerCase())) return null

  const list = url.searchParams.get('list')
  if (!list || !ID_PATTERN.test(list)) return null
  return list
}
