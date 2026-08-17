import {
  MarketplaceError,
  setProductPublication,
} from '@/lib/services/marketplace'
import { mobileFail, mobileOk, mobileOptions, mobileUser } from '../../../../_lib'

export const dynamic = 'force-dynamic'
export const OPTIONS = mobileOptions

const STATUS: Record<string, number> = {
  NOT_A_MEMBER: 403,
  READ_ONLY: 403,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
}

/**
 * Publish or withdraw one product from the Musuwo marketplace.
 *
 * THE BUSINESS ID IS REQUIRED AND IS NOT TRUSTED. It says which business the
 * caller claims to be acting for; `setProductPublication` then resolves their
 * membership on the server and scopes the update to that business's own
 * catalogue. A product id belonging to another merchant matches nothing.
 *
 * `NOT_A_MEMBER` and `NOT_FOUND` both mean "no" and deliberately reveal
 * nothing about whether the other thing exists.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await mobileUser(request)
  if (!user) return mobileFail('UNAUTHENTICATED', 'Sign in again to continue.', 401)

  let body: { businessId?: unknown; publish?: unknown }
  try {
    body = await request.json()
  } catch {
    return mobileFail('BAD_REQUEST', 'Expected a JSON body.', 400)
  }

  if (typeof body.businessId !== 'string') {
    return mobileFail('BAD_REQUEST', 'Which business is this for?', 400)
  }
  if (typeof body.publish !== 'boolean') {
    return mobileFail('BAD_REQUEST', 'publish must be true or false.', 400)
  }

  const { id } = await params

  try {
    await setProductPublication({
      userId: user.id,
      businessId: body.businessId,
      productId: id,
      publish: body.publish,
    })
    return mobileOk({ productId: id, publishToMusuwo: body.publish })
  } catch (error) {
    if (error instanceof MarketplaceError) {
      return mobileFail(error.code, error.message, STATUS[error.code] ?? 400)
    }
    console.error('[api/mobile/business/products/publish]', error)
    return mobileFail('FAILED', 'That could not be saved.', 500)
  }
}
