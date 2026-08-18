import { ShopCatalogue } from '@/app/components/shop/ShopCatalogue'
import type {
  CatalogueCategory,
  CatalogueProduct,
  WireMoney,
} from '@/app/components/shop/types'
import type { Money } from '@/lib/money'
import { listCategories, listPublicProducts } from '@/lib/services/products'

/**
 * Muroora Mart's own shop.
 *
 * Its shelves, its categories, its prices - and no mention of Musuwo, because
 * a customer buying mealie meal does not need to be told about the platform
 * that carries the order afterwards. The delivery is coordinated by Musuwo and
 * the customer finds that out at checkout, where it is actually relevant.
 *
 * The same code already serves /stores/muroora-mart/shop, which stays working:
 * that is the address Musuwo links to when it lists Muroora as a merchant, and
 * breaking it would break every link that already points there.
 */

const wireMoney = (value: Money): WireMoney => ({
  amount: value.amount.toString(),
  currency: value.currency,
  decimal: (Number(value.amount) / 100).toFixed(2),
})

export async function MurooraShop({ query }: { query: string }) {
  const [sourceProducts, sourceCategories] = await Promise.all([
    listPublicProducts(),
    listCategories(),
  ])

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
          description:
            categories.find((item) => item.id === product.categoryId)
              ?.description ?? null,
        }
      : null,
    images: product.images,
    availability: product.availability,
  }))

  return (
    <main>
      <header className="border-b border-rule bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-14">
          <p className="font-mono text-micro font-bold uppercase tracking-label text-accent">
            Muroora Mart
          </p>
          <h1 className="mt-4 max-w-[14ch] text-mega leading-[.95] text-support">
            Our shelves, our prices.
          </h1>
          <p className="mt-5 max-w-xl text-lead text-ink-soft">
            Groceries and household essentials, delivered around Mutare.
          </p>
        </div>
      </header>

      {products.length ? (
        <ShopCatalogue
          products={products}
          categories={categories}
          initialQuery={query}
        />
      ) : (
        <section className="mx-auto max-w-[86rem] px-gutter py-section">
          <div className="border border-rule bg-paper-sunk px-6 py-16 text-center">
            <h2 className="text-h2">Nothing on the shelves yet</h2>
            <p className="mt-3 text-ink-soft">
              Products appear here as soon as they are added and in stock.
            </p>
          </div>
        </section>
      )}
    </main>
  )
}
