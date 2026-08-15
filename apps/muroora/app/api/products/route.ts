import type { NextRequest } from 'next/server'

import { fail, ok, serialiseMoney } from '@/app/api/_lib/respond'
import { listPublicProducts } from '@/lib/services/products'

/**
 * GET /api/products
 *
 * The customer catalogue. PUBLIC — no authentication, by design: the brief is
 * explicit that customers browse without an account, and that products must
 * not be hidden from visitors who are not signed in.
 *
 * Query:
 *   ?category=basic-groceries   filter by category slug
 *   ?limit=50                   default 500
 *
 * This response NEVER contains cost price. It is built from
 * `listPublicProducts`, which selects its columns explicitly — see the note at
 * the top of lib/services/products.ts about why the public and admin reads are
 * two functions rather than one with a flag.
 *
 * Stock is a state, not a number. Clients get IN_STOCK / LOW_STOCK /
 * OUT_OF_STOCK rather than a live count.
 */
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const category = params.get('category') ?? undefined

    const rawLimit = params.get('limit')
    const limit = rawLimit ? Number(rawLimit) : undefined
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1 || limit > 500)) {
      return fail('BAD_REQUEST', 'limit must be a whole number from 1 to 500.')
    }

    const products = await listPublicProducts({ categorySlug: category, limit })

    return ok(
      products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        brand: p.brand,
        description: p.description,
        unitSize: p.unitSize,
        price: serialiseMoney(p.price),
        promoPrice: p.promoPrice ? serialiseMoney(p.promoPrice) : null,
        category: p.categorySlug
          ? { id: p.categoryId, name: p.categoryName, slug: p.categorySlug }
          : null,
        images: p.images,
        availability: p.availability,
      })),
    )
  } catch (error) {
    // The message is deliberately generic: a database error string can name
    // tables and columns, which is free reconnaissance for anyone probing.
    console.error('[api/products]', error)
    return fail('SERVER_ERROR', 'Could not load products.')
  }
}
