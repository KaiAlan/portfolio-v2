import type { Metadata } from 'next'
import ShopGrid from '@/components/shop/shop-grid'
import { getShopItems } from '@/lib/contentful'

export const metadata: Metadata = {
  title: 'Shop',
  description: 'Templates and resources by Kaialan.',
}

const ShopPage = async () => {
  const items = await getShopItems()

  return (
    <main className="w-full px-4 pb-16 sm:px-6 lg:px-9">
      <h1 className="type-display-lg mb-6">Shop</h1>
      <ShopGrid items={items} />
    </main>
  )
}

export default ShopPage
