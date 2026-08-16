import { fail, ok } from '@/app/api/_lib/respond'
import { currentUser, hasRole } from '@/lib/auth'
import { activeDeliveryForRider, RiderError } from '@/lib/services/riders'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await currentUser()
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to view rider deliveries.')
  if (!hasRole(user, 'RIDER')) return fail('FORBIDDEN', 'This account does not have rider access.')
  try {
    const delivery = await activeDeliveryForRider(user.id)
    return ok(
      delivery
        ? {
            ...delivery,
            merchandiseValueAmount: delivery.merchandiseValueAmount.toString(),
            riderEarningAmount: delivery.riderEarningAmount?.toString() ?? null,
          }
        : null,
    )
  } catch (error) {
    if (error instanceof RiderError) return fail('NOT_FOUND', error.message)
    console.error('[GET /api/rider/deliveries]', error)
    return fail('SERVER_ERROR', 'Could not load rider deliveries.')
  }
}
