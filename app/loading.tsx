import Skeleton from '@/components/ui/skeleton'

/**
 * Feed placeholder. Mirrors the masonry's own fallback grid rather than the
 * measured layout — the real columns are computed from each shot's aspect
 * ratio, which is not known until the data arrives.
 *
 * The filter row IS skeletoned here: it lives in the feed, not the header, so
 * it is absent until the data arrives and would otherwise shift the grid down
 * on load.
 */
const Loading = () => (
  <main className="w-full px-4 pb-16 sm:px-6 lg:px-9">
    <div className="flex items-center gap-2 pt-1 pb-5">
      {[64, 116, 148, 96, 84].map((w) => (
        <Skeleton key={w} className="h-8 rounded-pill" style={{ width: w }} />
      ))}
    </div>

    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-8 xl:grid-cols-4 min-[1560px]:grid-cols-5">
      {Array.from({ length: 15 }).map((_, i) => (
        <Skeleton key={i} style={{ aspectRatio: i % 3 === 0 ? '3 / 4' : '1 / 1' }} />
      ))}
    </div>
  </main>
)

export default Loading
