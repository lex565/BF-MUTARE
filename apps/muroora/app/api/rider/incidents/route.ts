import { z } from 'zod'

import { fail, ok } from '@/app/api/_lib/respond'
import { currentUser, hasRole } from '@/lib/auth'
import { DeliveryProofError, reportRiderIncident } from '@/lib/services/delivery-proof'

const incidentSchema = z
  .object({
    deliveryId: z.string().uuid().optional(),
    category: z.enum([
      'CUSTOMER_UNREACHABLE',
      'INCORRECT_ADDRESS',
      'RECIPIENT_UNAVAILABLE',
      'VEHICLE_BREAKDOWN',
      'DAMAGED_PACKAGE',
      'SAFETY_CONCERN',
      'CUSTOMER_DISPUTE',
      'SHOP_ISSUE',
      'PAYMENT_CASH_ISSUE',
      'OTHER',
    ]),
    note: z.string().trim().min(3).max(2000),
  })
  .strict()

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to report a rider issue.')
  if (!hasRole(user, 'RIDER')) return fail('FORBIDDEN', 'This account does not have rider access.')
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('BAD_REQUEST', 'Expected incident details.')
  }
  const parsed = incidentSchema.safeParse(body)
  if (!parsed.success) return fail('BAD_REQUEST', 'Choose a category and explain what happened.')
  try {
    const incident = await reportRiderIncident({ riderUserId: user.id, ...parsed.data })
    return ok({ id: incident.id, status: incident.status, createdAt: incident.createdAt.toISOString() }, { status: 201 })
  } catch (error) {
    if (error instanceof DeliveryProofError) return fail('BAD_REQUEST', error.message)
    console.error('[POST /api/rider/incidents]', error)
    return fail('SERVER_ERROR', 'Could not record the rider issue.')
  }
}
