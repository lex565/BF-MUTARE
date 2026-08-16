import { z } from 'zod'

import { fail, ok } from '@/app/api/_lib/respond'
import { currentUser, hasRole } from '@/lib/auth'
import { getRiderByUserId, RiderError, setRiderAvailability } from '@/lib/services/riders'

export const dynamic = 'force-dynamic'

export async function GET() {
  const user = await currentUser()
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to view your rider profile.')
  if (!hasRole(user, 'RIDER')) return fail('FORBIDDEN', 'This account does not have rider access.')
  try {
    const rider = await getRiderByUserId(user.id)
    return ok({
      publicRiderId: rider.publicRiderId,
      displayName: rider.displayName,
      operationalPhone: rider.operationalPhone,
      vehicleType: rider.vehicleType,
      vehicleMakeModel: rider.vehicleMakeModel,
      vehicleRegistration: rider.vehicleRegistration,
      vehicleColour: rider.vehicleColour,
      accountStatus: rider.accountStatus,
      verificationStatus: rider.verificationStatus,
      availability: rider.availability,
      currentExposureAmount: rider.currentExposureAmount.toString(),
      currency: rider.currency,
      completedDeliveries: rider.completedDeliveries,
      failedDeliveries: rider.failedDeliveries,
      incidentCount: rider.incidentCount,
    })
  } catch (error) {
    if (error instanceof RiderError) return fail('NOT_FOUND', error.message)
    console.error('[GET /api/rider/me]', error)
    return fail('SERVER_ERROR', 'Could not load the rider profile.')
  }
}

const availabilitySchema = z.object({ available: z.boolean() }).strict()

export async function PATCH(request: Request) {
  const user = await currentUser()
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to change availability.')
  if (!hasRole(user, 'RIDER')) return fail('FORBIDDEN', 'This account does not have rider access.')
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('BAD_REQUEST', 'Expected an availability value.')
  }
  const parsed = availabilitySchema.safeParse(body)
  if (!parsed.success) return fail('BAD_REQUEST', 'Availability must be true or false.')
  try {
    const rider = await setRiderAvailability(user.id, parsed.data.available)
    return ok({ availability: rider.availability })
  } catch (error) {
    if (error instanceof RiderError) return fail('CONFLICT', error.message)
    console.error('[PATCH /api/rider/me]', error)
    return fail('SERVER_ERROR', 'Could not change rider availability.')
  }
}
