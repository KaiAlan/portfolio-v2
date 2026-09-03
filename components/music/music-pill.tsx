'use client'

import { AudioLines, Pause, Play, SkipBack, SkipForward } from 'lucide-react'
import { pillTint, textOn, toCss } from '@/lib/music/color'
import { useMusic } from './music-context'

/**
 * The now-playing widget in the header — the real one.
 *
 * Deliberately a drop-in for the decorative `now-playing.tsx` it replaces:
 * same dimensions, same tokens, same `lg:` breakpoint, so swapping them in the
 * navbar changes behaviour without moving a pixel of layout.
 *
 * The one thing that inverts from that placeholder: the transport IS
 * `<button>`s here. Its comment explains that decorative glyphs must not be
 * buttons, because controls that announce as actionable and do nothing are a
 * trap. These do something, so they get to be real, focusable buttons — and
 * the wrapper drops `role="status"`, since a live region announcing on every
 * track change would interrupt a screen reader mid-sentence.
 *
 * Renders nothing when there is no provider, no playlist configured, or
 * YouTube could not be reached — the header then looks exactly as it does
 * without this feature, rather than carrying a dead control.
 *
 * The pill takes the cover's dominant colour. This is the one place in the
 * site where chrome carries colour instead of the imagery — project-card.tsx
 * states that rule, and this is a deliberate exception to it.
 */
const MusicPill = () => {
  const music = useMusic()
  if (!music || music.status === 'unavailable') return null

  const { status, track, color } = music
  const playing = status === 'playing'
  // The YouTube player object exists before its methods do. Until a state
  // lands, the transport would be a control that looks live and isn't.
  const ready = status !== 'loading'

  // Neutral until a colour resolves, so the pill never flashes an intermediate
  // shade. The transition carries it across when one arrives.
  //
  // pillTint, not the raw extracted colour: covers extract dark (real ones
  // gave rgb(38,56,56), rgb(74,66,32)) and would render as near-black slabs on
  // a light header, all looking alike. The tint keeps the hue and normalises
  // the rest.
  const tinted = color ? pillTint(color) : null
  const tint = tinted ? toCss(tinted) : undefined
  const light = !tinted || textOn(tinted) === 'ink'
  const titleClass = light ? 'text-ink' : 'text-on-dark'
  const metaClass = light ? 'text-muted-soft' : 'text-on-dark/70'

  return (
    <div
      className="hidden items-center gap-3 rounded-pill bg-control py-1.5 pr-4 pl-1.5 transition-colors duration-500 lg:flex"
      style={tint ? { backgroundColor: tint } : undefined}
    >
      <span className="relative grid size-9 shrink-0 place-items-center overflow-hidden rounded-pill bg-ink text-on-dark">
        {track ? (
          <img
            src={`https://img.youtube.com/vi/${track.videoId}/mqdefault.jpg`}
            alt=""
            width={36}
            height={36}
            className="size-full object-cover"
          />
        ) : (
          <AudioLines className="size-4" strokeWidth={2} aria-hidden />
        )}

        {/* While playing, the cover stays — losing "which song is this" for the
            whole time someone is listening is the wrong trade — and the
            waveform sits over it as a strip instead. */}
        {playing && track && (
          <span className="absolute inset-x-0 bottom-0 grid h-3.5 place-items-center bg-ink/65 text-on-dark">
            <AudioLines className="size-2.5" strokeWidth={2} aria-hidden />
          </span>
        )}
      </span>

      {/* min-w-0 lets truncation bite in a flex row; the max-w is what makes it
          happen at all. Real YouTube titles run 40+ characters and would
          otherwise stretch the pill across half the header. */}
      <span className="flex min-w-0 max-w-[190px] flex-col leading-tight">
        <span className={`type-meta truncate font-medium tracking-tight ${titleClass}`}>
          {/* Verbatim. YouTube titles are whatever the uploader typed —
              "Song - Artist (Official Video)" and worse — and no split
              heuristic survives a real playlist, so it truncates instead. */}
          {track?.title || (status === 'loading' ? 'Loading…' : 'Music')}
        </span>
        {track?.author && (
          <span className={`truncate text-[11px] leading-tight tracking-tight ${metaClass}`}>
            {track.author}
          </span>
        )}
      </span>

      <span className={`flex items-center gap-2.5 pl-2 ${titleClass}`}>
        <Control onClick={music.prev} label="Previous track" disabled={!ready}>
          <SkipBack className="size-4" strokeWidth={2} />
        </Control>
        <Control onClick={music.toggle} label={playing ? 'Pause' : 'Play'} disabled={!ready}>
          {playing ? (
            <Pause className="size-4" strokeWidth={2} />
          ) : (
            <Play className="size-4" strokeWidth={2} />
          )}
        </Control>
        <Control onClick={music.next} label="Next track" disabled={!ready}>
          <SkipForward className="size-4" strokeWidth={2} />
        </Control>
      </span>
    </div>
  )
}

const Control = ({
  onClick,
  label,
  disabled = false,
  children,
}: {
  onClick: () => void
  label: string
  disabled?: boolean
  children: React.ReactNode
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={label}
    disabled={disabled}
    className="transition-opacity hover:opacity-60 disabled:pointer-events-none disabled:opacity-40"
  >
    {children}
  </button>
)

export default MusicPill
