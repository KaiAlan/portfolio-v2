/** Every media URL in the app resolves through here.
 *
 *  Images are resized by Contentful's Images API, not next/image — that
 *  keeps Vercel's 5K/mo image-transformation cap untouched and costs
 *  nothing on Contentful's side. Video comes from R2 at cdn.kaialan.com.
 *
 *  Moving images off Contentful later is a change to this file alone. */
import type { Shot } from './types'

/** Responsive ladder. Kept short — every extra width is another variant
 *  Contentful has to serve fresh against the 50 GB/mo bandwidth cap. */
export const WIDTHS = [400, 640, 900, 1280, 1600, 2000] as const

type ImageOpts = { quality?: number; fit?: 'fill' | 'pad' | 'scale' | 'crop' | 'thumb' }

/** Contentful returns protocol-relative URLs (`//images.ctfassets.net/...`). */
const absolute = (url: string) => (url.startsWith('//') ? `https:${url}` : url)

const isContentful = (url: string) => url.includes('ctfassets.net')

/**
 * The one entry point. `size` is the intended rendered width in CSS px.
 * Non-Contentful URLs (R2 video, poster frames already on the CDN) pass
 * through untouched — they have no transform API.
 */
export function mediaUrl(shot: Shot, size?: number, opts: ImageOpts = {}): string {
  return imageUrl(shot.imageUrl, size, opts)
}

export function imageUrl(url: string, size?: number, opts: ImageOpts = {}): string {
  const src = absolute(url)
  if (!isContentful(src) || !size) return src

  const params = new URLSearchParams({
    w: String(Math.round(size)),
    fm: 'webp',
    q: String(opts.quality ?? 80),
  })
  if (opts.fit) params.set('fit', opts.fit)

  return `${src}?${params}`
}

/** `srcSet` for a plain <img>. Skips widths above the source's own width —
 *  upscaling costs bandwidth and buys nothing. */
export function srcSet(url: string, intrinsicWidth?: number, opts: ImageOpts = {}): string {
  const src = absolute(url)
  if (!isContentful(src)) return ''

  return WIDTHS.filter((w, i) => !intrinsicWidth || w <= intrinsicWidth || WIDTHS[i - 1] < intrinsicWidth)
    .map((w) => `${imageUrl(src, w, opts)} ${w}w`)
    .join(', ')
}

/** <source> list for a shot's video, WebM first so browsers that support
 *  it never download the larger MP4. */
export function videoSources(shot: Shot): { src: string; type: string }[] {
  const out: { src: string; type: string }[] = []
  if (shot.videoWebmUrl) out.push({ src: shot.videoWebmUrl, type: 'video/webm' })
  if (shot.videoMp4Url) out.push({ src: shot.videoMp4Url, type: 'video/mp4' })
  return out
}

/** Masonry needs this before any byte of image arrives. */
export const aspectRatio = (shot: Shot) => shot.width / shot.height
