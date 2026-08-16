'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'

import { ProductCard } from './ProductCard'
import type { CatalogueCategory, CatalogueProduct } from './types'

interface ShopCatalogueProps {
  products: CatalogueProduct[]
  categories: CatalogueCategory[]
  initialCategory?: string
  /** Search term carried in from the homepage search box. */
  initialQuery?: string
}

export function ShopCatalogue({
  products,
  categories,
  initialCategory = 'all',
  initialQuery = '',
}: ShopCatalogueProps) {
  const [query, setQuery] = useState(initialQuery)
  const [category, setCategory] = useState(initialCategory)
  const [stockOnly, setStockOnly] = useState(false)

  const visibleProducts = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return products.filter((product) => {
      const matchesCategory =
        category === 'all' || product.category?.slug === category
      const matchesStock = !stockOnly || product.availability !== 'OUT_OF_STOCK'
      const matchesQuery =
        !needle ||
        [product.name, product.brand, product.unitSize, product.category?.name]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(needle))
      return matchesCategory && matchesStock && matchesQuery
    })
  }, [category, products, query, stockOnly])

  return (
    <>
      <div className="sticky top-[4.5rem] z-30 border-y border-rule bg-paper/95 backdrop-blur-md">
        <div className="mx-auto grid max-w-[86rem] gap-4 px-gutter py-4 lg:grid-cols-[minmax(16rem,1fr)_auto] lg:items-center">
          <label className="relative block">
            <span className="sr-only">Search products</span>
            <span
              aria-hidden
              className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint"
            >
              ⌕
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search rice, soap, cooking oil…"
              className="min-h-12 w-full border border-rule bg-white py-3 pl-11 pr-4 text-base outline-none transition-colors placeholder:text-ink-faint focus:border-support"
            />
          </label>

          <label className="flex min-h-12 cursor-pointer items-center gap-3 border border-rule bg-white px-4 font-mono text-micro uppercase tracking-label">
            <input
              type="checkbox"
              checked={stockOnly}
              onChange={(event) => setStockOnly(event.target.checked)}
              className="size-4 accent-support"
            />
            In stock only
          </label>
        </div>
      </div>

      <section className="mx-auto max-w-[86rem] px-gutter py-10 md:py-14">
        <div className="flex gap-3 overflow-x-auto pb-3" aria-label="Product categories">
          <button
            type="button"
            onClick={() => setCategory('all')}
            aria-pressed={category === 'all'}
            className={`shrink-0 rounded-full border px-5 py-2.5 font-mono text-micro uppercase tracking-label transition-colors ${
              category === 'all'
                ? 'border-support bg-support text-white'
                : 'border-rule bg-paper hover:border-support'
            }`}
          >
            All products
          </button>
          {categories.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setCategory(item.slug)}
              aria-pressed={category === item.slug}
              className={`shrink-0 rounded-full border px-5 py-2.5 font-mono text-micro uppercase tracking-label transition-colors ${
                category === item.slug
                  ? 'border-support bg-support text-white'
                  : 'border-rule bg-paper hover:border-support'
              }`}
            >
              {item.name}
            </button>
          ))}
        </div>

        <div className="mt-8 flex items-end justify-between gap-4 border-b border-rule pb-5">
          <div>
            <p className="font-mono text-micro uppercase tracking-label text-accent">
              Live catalogue
            </p>
            <h2 className="mt-2 text-h2">
              {visibleProducts.length}{' '}
              {visibleProducts.length === 1 ? 'product' : 'products'}
            </h2>
          </div>
          <Link
            href="/cart"
            className="font-mono text-micro font-bold uppercase tracking-label text-support hover:text-accent"
          >
            View cart →
          </Link>
        </div>

        {visibleProducts.length > 0 ? (
          <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 xl:grid-cols-4">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <div className="my-14 border border-dashed border-rule bg-paper-sunk px-6 py-16 text-center">
            <p className="text-h3 font-bold">Nothing matches that search</p>
            <p className="mx-auto mt-3 max-w-md text-ink-soft">
              Try another product name or clear the category and stock filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery('')
                setCategory('all')
                setStockOnly(false)
              }}
              className="mt-6 border border-ink px-6 py-3 font-mono text-micro uppercase tracking-label hover:bg-ink hover:text-paper"
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
    </>
  )
}
