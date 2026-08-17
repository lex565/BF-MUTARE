import type { Metadata } from 'next'

import { MusuwoShopCatalogue } from './MusuwoShopCatalogue'

export const metadata: Metadata = {
  title: 'Shop across Musuwo',
  description: 'Search products shared by approved businesses on Musuwo.',
}

export default async function MusuwoShopPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams
  const products: [] = []
  return <MusuwoShopCatalogue products={products} initialQuery={q ?? ''} />
}
