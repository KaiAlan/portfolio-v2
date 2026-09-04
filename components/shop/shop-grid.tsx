import { imageUrl, srcSet } from '@/lib/media'
import type { ShopItem } from '@/lib/types'

/**
 * External-link cards. Every item leaves the site, so these are plain
 * anchors with rel="noreferrer", not internal routes.
 */

type ShopGridProps = {
  items: ShopItem[]
}

const ShopGrid = ({ items }: ShopGridProps) => {
  if (items.length === 0) {
    return <p className="type-body py-16 text-muted">Nothing listed yet.</p>
  }

  return (
    <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={item.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="group block"
          >
            <div className="overflow-hidden rounded-card bg-surface-warm">
              <img
                src={imageUrl(item.imageUrl, 900)}
                srcSet={srcSet(item.imageUrl)}
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                alt={item.title}
                loading="lazy"
                decoding="async"
                // --dur-base, down from 300ms. A hover scale is direct
                // feedback: at 300ms the image is still growing well after
                // the pointer has settled, which reads as lag rather than as
                // response. transform-only, so it stays on the compositor.
                className="h-full w-full object-cover transition-transform duration-(--dur-base) group-hover:scale-[1.02]"
              />
            </div>
            <div className="mt-3 flex items-baseline justify-between gap-3">
              <p className="type-button text-ink">{item.title}</p>
              {item.priceLabel && <p className="type-meta text-muted">{item.priceLabel}</p>}
            </div>
            {item.description && (
              <p className="type-meta mt-1 text-muted">{item.description}</p>
            )}
          </a>
        </li>
      ))}
    </ul>
  )
}

export default ShopGrid
