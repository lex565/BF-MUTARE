import { z } from 'zod'

import { fail, ok } from '@/app/api/_lib/respond'
import { currentUser, hasRole } from '@/lib/auth'
import {
  advanceRiderDelivery,
  respondToDeliveryOffer,
  RiderError,
} from '@/lib/services/riders'

const actionSchema = z
  .object({
    action: z.enum([
      'ACCEPT',
      'DECLINE',
      'EN_ROUTE_TO_PICKUP',
      'ARRIVED_PICKUP',
      'CONFIRM_HANDOVER',
      'EN_ROUTE_TO_CUSTOMER',
      'ARRIVED_CUSTOMER',
    ]),
    reason: z.string().trim().max(500).optional(),
  })
  .strict()

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser()
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to update a delivery.')
  if (!hasRole(user, 'RIDER')) return fail('FORBIDDEN', 'This account does not have rider access.')
  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('BAD_REQUEST', 'Expected a delivery action.')
  }
  const parsed = actionSchema.safeParse(body)
  if (!parsed.success) return fail('BAD_REQUEST', 'That delivery action is not valid.')
  try {
    if (parsed.data.action === 'ACCEPT' || parsed.data.action === 'DECLINE') {
      return ok(
        await respondToDeliveryOffer(
          user.id,
          id,
          parsed.data.action === 'ACCEPT',
          parsed.data.reason,
        ),
      )
    }
    if (parsed.data.action === 'CONFIRM_HANDOVER') {
      const { confirmRiderHandover } = await import('@/lib/services/riders')
      const delivery = await confirmRiderHandover(user.id, id)
      return ok({ id: delivery.id, status: delivery.status, custodyState: delivery.custodyState })
    }
    const delivery = await advanceRiderDelivery(user.id, id, parsed.data.action)
    return ok({ id: delivery.id, status: delivery.status, custodyState: delivery.custodyState })
  } catch (error) {
    if (error instanceof RiderError) {
      return fail(error.code === 'NOT_FOUND' ? 'NOT_FOUND' : 'CONFLICT', error.message)
    }
    console.error('[PATCH /api/rider/deliveries/:id]', error)
    return fail('SERVER_ERROR', 'Could not update the delivery.')
  }
}
