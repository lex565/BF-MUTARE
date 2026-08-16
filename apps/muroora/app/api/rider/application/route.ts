import { z } from 'zod'

import { fail, ok } from '@/app/api/_lib/respond'
import { currentUser } from '@/lib/auth'
import { createRiderApplication, getRiderByUserId, RiderError } from '@/lib/services/riders'

export const dynamic = 'force-dynamic'

const applicationSchema = z
  .object({
    displayName: z.string().trim().min(2).max(80),
    operationalPhone: z.string().trim().min(7).max(30).optional(),
    vehicleType: z.enum(['BICYCLE', 'MOTORBIKE', 'CAR']).optional(),
    vehicleMakeModel: z.string().trim().max(100).optional(),
    vehicleRegistration: z.string().trim().max(40).optional(),
    vehicleColour: z.string().trim().max(40).optional(),
  })
  .strict()

export async function GET() {
  const user = await currentUser()
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to view a rider application.')
  try {
    const rider = await getRiderByUserId(user.id)
    return ok({
      publicRiderId: rider.publicRiderId,
      displayName: rider.displayName,
      accountStatus: rider.accountStatus,
      verificationStatus: rider.verificationStatus,
      vehicleType: rider.vehicleType,
      joinedAt: rider.joinedAt.toISOString(),
    })
  } catch (error) {
    if (error instanceof RiderError && error.code === 'NOT_FOUND') return ok(null)
    console.error('[GET /api/rider/application]', error)
    return fail('SERVER_ERROR', 'Could not load the rider application.')
  }
}

export async function POST(request: Request) {
  const user = await currentUser()
  if (!user) return fail('UNAUTHENTICATED', 'Sign in before applying.')
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('BAD_REQUEST', 'Expected rider application details.')
  }
  const parsed = applicationSchema.safeParse(body)
  if (!parsed.success) {
    return fail(
      'BAD_REQUEST',
      'Only basic operational rider and vehicle details are accepted right now.',
      parsed.error.flatten().fieldErrors,
    )
  }
  try {
    const rider = await createRiderApplication({ userId: user.id, ...parsed.data })
    return ok(
      {
        publicRiderId: rider.publicRiderId,
        accountStatus: rider.accountStatus,
        verificationStatus: rider.verificationStatus,
      },
      { status: 201 },
    )
  } catch (error) {
    if (error instanceof RiderError) {
      return fail(error.code === 'DUPLICATE' ? 'CONFLICT' : 'BAD_REQUEST', error.message)
    }
    console.error('[POST /api/rider/application]', error)
    return fail('SERVER_ERROR', 'Could not create the rider application.')
  }
}
