import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AddToCartButton } from '@/app/components/shop/AddToCartButton'
import { ProductImage } from '@/app/components/shop/ProductImage'
import { moneyLabel, type WireMoney } from '@/app/components/shop/types'
import type { Money } from '@/lib/money'
import { getPublicProduct } from '@/lib/services/products'

export const dynamic = 'force-dynamic'

const wireMoney = (value: Money): WireMoney => ({
  amount: value.amount.toString(),
  currency: value.currency,
  decimal: (Number(value.amount) / 100).toFixed(2),
})

export async function generateMetadata({
  params,
}: PageProps<'/product/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const product = await getPublicProduct(slug)
  return product
    ? {
        title: product.name,
        description:
          product.description ??
          `Shop ${product.name} from Muroora Mart for delivery in Mutare.`,
      }
    : { title: 'Product not found' }
}

const availabilityCopy = {
  IN_STOCK: {
    label: 'In stock',
    note: 'Available to add to your basket now.',
    className: 'text-support',
  },
  LOW_STOCK: {
    label: 'Only a few left',
    note: 'Order soon. Final availability is confirmed at checkout.',
    className: 'text-accent-deep',
  },
  OUT_OF_STOCK: {
    label: 'Out of stock',
    note: 'This item cannot be added right now.',
    className: 'text-ink-faint',
  },
} as const

export default async function ProductPage({
  params,
}: PageProps<'/product/[slug]'>) {
  const { slug } = await params
  const product = await getPublicProduct(slug)
  if (!product) notFound()

  const availability = availabilityCopy[product.availability]
  const price = wireMoney(product.promoPrice ?? product.price)

  return (
    <main className="border-b border-rule">
      <div className="mx-auto max-w-[86rem] px-gutter py-8 md:py-14">
        <nav aria-label="Breadcrumb" className="font-mono text-micro uppercase tracking-label text-ink-faint">
          <Link href="/shop" className="hover:text-support">Shop</Link>
          {product.categorySlug && (
            <>
              <span aria-hidden className="mx-2">/</span>
              <Link
                href={`/shop/category/${product.categorySlug}`}
                className="hover:text-support"
              >
                {product.categoryName}
              </Link>
            </>
          )}
        </nav>

        <div className="mt-7 grid gap-9 lg:grid-cols-[minmax(0,1.05fr)_minmax(22rem,0.75fr)] lg:gap-16">
          <ProductImage
            image={product.images[0]}
            name={product.name}
            priority
            className="w-full"
          />

          <section className="flex flex-col justify-center lg:py-10">
            {product.brand && (
              <p className="font-mono text-micro uppercase tracking-label text-accent">
                {product.brand}
              </p>
            )}
            <h1 className="mt-3 text-mega leading-[0.98]">{product.name}</h1>
            {product.unitSize && (
              <p className="mt-3 text-lead text-ink-soft">{product.unitSize}</p>
            )}

            <div className="mt-8 flex items-end gap-4 border-y border-rule py-6">
              <p className="font-display text-h1 font-extrabold">{moneyLabel(price)}</p>
              {product.promoPrice && (
                <p className="pb-1 text-lead text-ink-faint line-through">
                  {moneyLabel(wireMoney(product.price))}
                </p>
              )}
            </div>

            <div className="mt-6">
              <p className={`font-mono text-micro font-bold uppercase tracking-label ${availability.className}`}>
                {availability.label}
              </p>
              <p className="mt-2 text-small text-ink-soft">{availability.note}</p>
            </div>

            {product.description && (
              <p className="mt-7 max-w-measure text-ink-soft">
                {product.description}
              </p>
            )}

            <div className="mt-9 max-w-md">
              <AddToCartButton
                productId={product.id}
                disabled={product.availability === 'OUT_OF_STOCK'}
              />
              <p className="mt-3 text-small text-ink-faint">
                No account needed. Delivery area and fee are confirmed during checkout.
              </p>
            </div>
          </section>
        </div>
      </div>
    </main>
  )
}
