# Nav music player — design

**Date:** 2026-09-03
**Status:** approved, building

A persistent music pill in the navbar. Cover art, title, artist, and
prev/play/next, tinted with the colour of whatever is playing. Audio comes from
a public YouTube playlist through a hidden IFrame player.

---

## Why YouTube and not self-hosted

Self-hosting audio needs R2, which is **blocked on no card on file**, and it
puts the music licence on Kai. YouTube already holds the licence, hosts the
bytes, and costs nothing. It also lifts the catalogue limit — real nostalgia
tracks are on YouTube and are not on SoundCloud, and Spotify's embed only plays
30-second previews unless the *visitor* is a logged-in Premium user.

This is the same architecture `salon.wtf` / `deluxsalon.in` use. Confirmed by
reading deluxsalon.in's source, which describes its own player as *"kept in
normal flow, with standard 200[px]… visually clipped via overflow/opacity"* —
independently the same approach chosen here.

**The trade:** YouTube's [Required Minimum Functionality][rmf] wants a visible
≥200×200 player, and the [Developer Policies][dp] prohibit isolating audio from
video. A hidden player is against the letter of that. Kai decided knowingly:
keep a real 200×200 player in normal flow, `opacity-0 pointer-events-none`, so
it exists at the required size rather than being collapsed to nothing. Link the
source playlist in the footer, as deluxsalon does.

[rmf]: https://developers.google.com/youtube/terms/required-minimum-functionality
[dp]: https://developers.google.com/youtube/terms/developer-policies-guide

## Decisions already made

| Question | Decision |
|---|---|
| Placement | Always-visible pill, right-hand nav group, beside X / Contact |
| Track data | None stored. YouTube's playlist *is* the content |
| Admin editing | One `youtubePlaylistId` field on `siteSettings` |
| Per-track edits | On youtube.com, not in the studio |
| Progress bar | None. Cover, title, artist, prev/play/next only |
| Cover art | `img.youtube.com/vi/<id>/hqdefault.jpg`, circle-cropped |
| Pill tint | Dominant colour of the cover, extracted client-side |

## Architecture

**`MusicProvider` mounts once in `app/layout.tsx`**, beside `Navbar`, above the
page tree — so client-side route changes never remount it and playback survives
navigation. It owns the hidden player, the playback state, the current track,
and a `Map<videoId, colour>` cache.

**`MusicPill` is a dumb consumer** reading that context, same shape as
`lightbox-context.ts`. It renders nothing when the provider reports
`unavailable`.

```
app/layout.tsx
└── MusicProvider          ← hidden YT player + all state
    ├── Navbar
    │   └── MusicPill      ← context consumer, pure UI
    └── {children}
```

### Data flow

1. `getSiteSettings()` (already cached, already tagged) gains `youtubePlaylistId`.
2. Provider loads `youtube.com/iframe_api`, constructs `YT.Player` on a
   200×200 box with `playerVars: { listType: 'playlist', list: <id> }`.
3. On `onReady` / `onStateChange`: `getVideoData()` → `{ video_id, title, author }`.
4. `video_id` → thumbnail URL → `<img crossOrigin="anonymous">` → offscreen
   canvas → `dominantColor()` → cached by video id.
5. `textOn(colour)` picks `ink` or `on-dark` so the label stays legible against
   whatever came back.

Cross-origin canvas reads work: both `i.ytimg.com` and `img.youtube.com` return
`access-control-allow-origin: *` (verified). No server round trip, no proxy, no
new dependency.

## Modules

Pure logic is separated so it can be unit-tested, matching how `lib/admin/*`
splits from its I/O.

- **`lib/music/color.ts`** (pure, tested)
  - `dominantColor(data: Uint8ClampedArray): RGB | null` — buckets pixels by
    4-bit-per-channel key and returns the most common bucket's average. Skips
    transparent, near-black and near-white pixels: `hqdefault.jpg` letterboxes
    16:9 video into a 4:3 frame, so black bars would otherwise win outright.
    **Runs a colourful-pixels-only pass first**, falling back to all pixels for
    monochrome artwork — see the finding below.
  - `pillTint(rgb): RGB` — keeps the hue, normalises lightness and saturation
    into a band the header can wear. See the finding below.
  - `textOn(rgb): 'ink' | 'on-dark'` — WCAG relative luminance against a
    threshold.
  - `toCss(rgb): string`
- **`lib/music/playlist.ts`** (pure, tested)
  - `parsePlaylistId(input): string | null` — accepts a bare ID or any
    playlist URL, so the studio field can take a pasted link.
- **`components/music/music-context.ts`** — context + `useMusic()`.
- **`components/music/music-provider.tsx`** — `'use client'`. Script loading,
  player lifecycle, state machine, colour extraction.
- **`components/music/music-pill.tsx`** — `'use client'`. The UI.

## Behaviour

**States:** `loading → ready → playing / paused`, plus `unavailable`.

- **No autoplay.** Browsers require a gesture; the play button is that gesture.
  On load the pill shows the first track, paused.
- **Looping.** `setLoop(true)`, so next past the end and previous from the
  start both wrap.
- **Cover stays visible while playing.** A small animated waveform badge sits in
  the corner of the circle rather than replacing the art — losing "which song is
  this" for the whole time someone is listening is the wrong trade.
- **Titles truncate**, never wrap. Real YouTube titles
  (`"Song — Artist (Official Video)"`) do not split reliably into two clean
  lines, and no parsing heuristic survives contact with a real playlist. `title`
  goes on line one, `author` (the *channel*, which is not always the performer)
  on line two. Cleanliness depends on which uploads go in the playlist.
- **Tint transitions** rather than popping, and falls back to `surface-warm`
  until a colour resolves.

### Failure modes

- **No playlist id set, or the API script never loads** (corporate networks,
  region blocks, opt-in click-to-load blockers): provider reports `unavailable`,
  pill renders nothing, nav looks exactly as it does today. This is an edge
  case, not a common one — default ad-blocker lists do not touch YouTube
  embeds.
- **`onError` from YouTube** (video deleted, made private, or embedding
  disabled — inevitable across a playlist of old uploads): skip to the next
  track rather than sitting stuck on a dead one.
- **Canvas extraction fails**: keep the neutral pill. Never block playback on a
  colour.

## The one rule this breaks, deliberately

`project-card.tsx` states the house rule: *"Chrome stays monochrome; the imagery
carries all the colour."* A cover-tinted pill is chrome carrying colour. It is
the point of the feature, and it is the only place in the site that does this.
Noted here so the next person finds a decision rather than an inconsistency.

## Found while verifying against a real playlist

Three things that only showed up with actual covers in a real browser, all
fixed:

1. **The literal dominant colour is unusable.** Music-video thumbnails are
   mostly dark, desaturated background, so the most common colour came back
   near-black grey on cover after cover — `rgb(38,41,37)`, then `rgb(39,39,39)`.
   Every pill looked the same, and dark. `dominantColor` now scores only
   colourful pixels first (HSV saturation ≥ 0.18), falling back to all pixels
   so monochrome artwork still gets a tint instead of nothing.
2. **Even the saturated colour is too dark to use raw** — `rgb(38,56,56)`,
   `rgb(74,66,32)`. On a `#f7f5f3` header those render as near-black slabs.
   `pillTint` keeps the hue and clamps lightness to 0.82–0.90 and saturation to
   ≤0.55, which gives `rgb(200,218,218)` and `rgb(227,220,191)` — clearly hued,
   clearly different from each other, and legible under dark ink. Saturation is
   only ever clamped *down*, so a grey cover stays grey rather than being given
   a hue it never had.
3. **`getVideoData().author` is empty while a track is merely cued** and only
   populates once playback starts. The first implementation compared tracks by
   `video_id` alone, so the late-arriving author was never picked up and the
   artist line never rendered. `syncTrack` now compares every field. The pill
   therefore shows one line before first play and two after, which is honest
   rather than a bug.

Also: the title column needs an explicit `max-w`. `min-w-0` alone lets the
flex item grow to fit, and real titles ran the pill to 441px before it was
capped.

## Testing

Same split the rest of the repo uses. `lib/music/*` gets Vitest coverage —
colour bucketing including the letterbox case, the luminance threshold either
side, playlist-id parsing across URL shapes and junk input. The player,
canvas, and DOM integration are verified in a browser, as with every other
client concern here.
