import Link from 'next/link'

import { AddToCartButton } from './AddToCartButton'
import { ProductImage } from './ProductImage'
import { moneyLabel, type CatalogueProduct } from './types'

const availabilityLabel = {
  IN_STOCK: 'In stock',
  LOW_STOCK: 'Only a few left',
  OUT_OF_STOCK: 'Out of stock',
} as const

export function ProductCard({ product }: { product: CatalogueProduct }) {
  const sellingPrice = product.promoPrice ?? product.price

  return (
    <article className="group flex h-full flex-col border border-rule bg-paper transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-[0_18px_45px_rgba(18,39,27,0.10)]">
      <Link href={`/product/${product.slug}`} className="block">
        <ProductImage image={product.images[0]} name={product.name} />
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-3">
          <p
            className={`font-mono text-[0.68rem] font-bold uppercase tracking-label ${
              product.availability === 'OUT_OF_STOCK'
                ? 'text-ink-faint'
                : product.availability === 'LOW_STOCK'
                  ? 'text-accent-deep'
                  : 'text-support'
            }`}
          >
            {availabilityLabel[product.availability]}
          </p>
          {product.unitSize && (
            <span className="text-small text-ink-faint">{product.unitSize}</span>
          )}
        </div>

        <Link href={`/product/${product.slug}`} className="mt-3 block">
          <h2 className="text-h4 font-bold leading-tight transition-colors group-hover:text-support">
            {product.name}
          </h2>
        </Link>
        {product.brand && (
          <p className="mt-1 text-small text-ink-faint">{product.brand}</p>
        )}

        <div className="mt-auto flex items-end justify-between gap-3 pb-5 pt-7">
          <div>
            <p className="font-display text-h4 font-extrabold text-ink">
              {moneyLabel(sellingPrice)}
            </p>
            {product.promoPrice && (
              <p className="text-small text-ink-faint line-through">
                {moneyLabel(product.price)}
              </p>
            )}
          </div>
        </div>

        <AddToCartButton
          productId={product.id}
          disabled={product.availability === 'OUT_OF_STOCK'}
          compact
        />
      </div>
    </article>
  )
}
