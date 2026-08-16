import type { Metadata } from 'next'

import { ShopCatalogue } from '@/app/components/shop/ShopCatalogue'
import type {
  CatalogueCategory,
  CatalogueProduct,
  WireMoney,
} from '@/app/components/shop/types'
import { listCategories, listPublicProducts } from '@/lib/services/products'
import type { Money } from '@/lib/money'

export const metadata: Metadata = {
  title: 'Shop groceries and household essentials',
  description:
    'Browse Muroora Mart products currently available in Mutare. Shop as a guest and send the order to yourself or someone else.',
}

export const dynamic = 'force-dynamic'

const wireMoney = (value: Money): WireMoney => ({
  amount: value.amount.toString(),
  currency: value.currency,
  decimal: (Number(value.amount) / 100).toFixed(2),
})

const categoryShape = (
  category: Awaited<ReturnType<typeof listCategories>>[number],
): CatalogueCategory => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  description: category.description,
})

export default async function ShopPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q } = await searchParams
  const [sourceProducts, sourceCategories] = await Promise.all([
    listPublicProducts(),
    listCategories(),
  ])

  const categories = sourceCategories.map(categoryShape)
  const products: CatalogueProduct[] = sourceProducts.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    brand: product.brand,
    description: product.description,
    unitSize: product.unitSize,
    price: wireMoney(product.price),
    promoPrice: product.promoPrice ? wireMoney(product.promoPrice) : null,
    category: product.categoryId
      ? {
          id: product.categoryId,
          name: product.categoryName!,
          slug: product.categorySlug!,
          description:
            categories.find((item) => item.id === product.categoryId)?.description ??
            null,
        }
      : null,
    images: product.images,
    availability: product.availability,
  }))

  return (
    <main>
      <header className="border-b border-rule bg-support text-white">
        <div className="mx-auto max-w-[86rem] px-gutter py-14 md:py-20">
          <p className="font-mono text-micro font-bold uppercase tracking-label text-orange-200">
            Muroora Mart · Mutare
          </p>
          <div className="mt-5 grid gap-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
            <h1 className="max-w-[14ch] text-mega leading-[0.95]">
              The household shop, without the runaround.
            </h1>
            <p className="max-w-measure text-lead text-white/80">
              Browse what is actually available, build your basket without an
              account, and send it to an address in Mutare—for yourself or
              somebody you care about.
            </p>
          </div>
        </div>
      </header>

      {products.length > 0 ? (
        <ShopCatalogue products={products} categories={categories} initialQuery={q ?? ""} />
      ) : (
        <section className="mx-auto max-w-[86rem] px-gutter py-section">
          <div className="border border-rule bg-paper-sunk px-6 py-16 text-center">
            <p className="font-mono text-micro uppercase tracking-label text-accent">
              Catalogue setup
            </p>
            <h2 className="mt-3 text-h2">The shelves are being added online</h2>
            <p className="mx-auto mt-4 max-w-xl text-ink-soft">
              No products have been published yet. Muroora only lists confirmed
              shop stock, so you will never see invented items or prices here.
            </p>
          </div>
        </section>
      )}
    </main>
  )
}
