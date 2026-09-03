import { cn } from '@/lib/utils'

/**
 * The one loading surface. Every placeholder in the app is this component so
 * they pulse in step and share a single colour — `surface-warm`, the same grey
 * a card sits on, so a skeleton reads as the empty frame of the thing it is
 * standing in for rather than as a separate element.
 */
const Skeleton = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    aria-hidden
    className={cn('animate-pulse rounded-card bg-surface-warm', className)}
    {...props}
  />
)

export default Skeleton
