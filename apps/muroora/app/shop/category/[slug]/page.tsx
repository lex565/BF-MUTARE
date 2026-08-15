import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { ShopCatalogue } from '@/app/components/shop/ShopCatalogue'
import type {
  CatalogueCategory,
  CatalogueProduct,
  WireMoney,
} from '@/app/components/shop/types'
import type { Money } from '@/lib/money'
import { listCategories, listPublicProducts } from '@/lib/services/products'

export const dynamic = 'force-dynamic'

const wireMoney = (value: Money): WireMoney => ({
  amount: value.amount.toString(),
  currency: value.currency,
  decimal: (Number(value.amount) / 100).toFixed(2),
})

export async function generateMetadata({
  params,
}: PageProps<'/shop/category/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const categories = await listCategories()
  const category = categories.find((item) => item.slug === slug)
  return category
    ? {
        title: category.name,
        description: category.description ?? `Shop ${category.name} at Muroora Mart.`,
      }
    : { title: 'Category not found' }
}

export default async function CategoryPage({
  params,
}: PageProps<'/shop/category/[slug]'>) {
  const { slug } = await params
  const [sourceCategories, sourceProducts] = await Promise.all([
    listCategories(),
    listPublicProducts(),
  ])
  const active = sourceCategories.find((item) => item.slug === slug)
  if (!active) notFound()

  const categories: CatalogueCategory[] = sourceCategories.map((category) => ({
    id: category.id,
    name: category.name,
    slug: category.slug,
    description: category.description,
  }))
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
          description: categories.find((item) => item.id === product.categoryId)
            ?.description ?? null,
        }
      : null,
    images: product.images,
    availability: product.availability,
  }))

  return (
    <main>
      <header className="border-b border-rule bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-14 md:py-20">
          <p className="font-mono text-micro uppercase tracking-label text-accent">
            Shop by category
          </p>
          <h1 className="mt-4 text-mega leading-none">{active.name}</h1>
          {active.description && (
            <p className="mt-5 max-w-measure text-lead text-ink-soft">
              {active.description}
            </p>
          )}
        </div>
      </header>
      <ShopCatalogue
        products={products}
        categories={categories}
        initialCategory={slug}
      />
    </main>
  )
}
