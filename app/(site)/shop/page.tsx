import type { Metadata } from 'next'
import ComingSoon from '@/components/ui/coming-soon'

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Templates and resources by Kaialan — coming soon.',
}

/**
 * Placeholder, deliberately — not an unfinished page.
 *
 * The real grid is built and works: `components/shop/shop-grid.tsx` and
 * `getShopItems()` in lib/contentful.ts are both intact and still tested by
 * the build. There is simply nothing to sell yet — `shopItem` has zero
 * entries — and rendering an empty grid under a heading reads as broken
 * rather than as forthcoming.
 *
 * To ship the real thing: add shopItem entries, then restore this page to
 * `<ShopGrid items={await getShopItems()} />`. Nothing else has to change.
 */
const ShopPage = () => (
  <ComingSoon title="Shop">
    Templates and resources, once there are some worth charging for. Not yet.
  </ComingSoon>
)

export default ShopPage
