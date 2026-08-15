import { fail, ok, serialiseMoney } from '@/app/api/_lib/respond'
import { getPublicProduct } from '@/lib/services/products'

/**
 * GET /api/products/[slug]
 *
 * One product, for a product detail page. Public, and free of cost price for
 * the same reason as the list endpoint.
 */
export const dynamic = 'force-dynamic'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const product = await getPublicProduct(slug)

    if (!product) {
      // Same response for "never existed" and "hidden by an admin". A
      // distinction here would let anyone enumerate withdrawn products.
      return fail('NOT_FOUND', 'No such product.')
    }

    return ok({
      id: product.id,
      name: product.name,
      slug: product.slug,
      sku: product.sku,
      brand: product.brand,
      description: product.description,
      unitSize: product.unitSize,
      price: serialiseMoney(product.price),
      promoPrice: product.promoPrice ? serialiseMoney(product.promoPrice) : null,
      category: product.categorySlug
        ? {
            id: product.categoryId,
            name: product.categoryName,
            slug: product.categorySlug,
          }
        : null,
      images: product.images,
      availability: product.availability,
    })
  } catch (error) {
    console.error('[api/products/:slug]', error)
    return fail('SERVER_ERROR', 'Could not load that product.')
  }
}
