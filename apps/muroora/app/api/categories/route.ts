import { fail, ok } from '@/app/api/_lib/respond'
import { listCategories } from '@/lib/services/products'

/**
 * GET /api/categories
 *
 * The six real categories from Muroora Mart's own company profile. Public.
 * Used for shop navigation and the category filter.
 */
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    return ok(await listCategories())
  } catch (error) {
    console.error('[api/categories]', error)
    return fail('SERVER_ERROR', 'Could not load categories.')
  }
}
