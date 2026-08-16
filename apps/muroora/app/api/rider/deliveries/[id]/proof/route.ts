import { headers } from 'next/headers'
import { z } from 'zod'

import { fail, ok } from '@/app/api/_lib/respond'
import { currentUser, hasRole } from '@/lib/auth'
import { DeliveryProofError, verifyDeliveryOtp } from '@/lib/services/delivery-proof'

const proofSchema = z.object({ otp: z.string().regex(/^\d{6}$/) }).strict()

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await currentUser()
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to confirm delivery.')
  if (!hasRole(user, 'RIDER')) return fail('FORBIDDEN', 'This account does not have rider access.')
  const { id } = await params
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return fail('BAD_REQUEST', 'Expected a six-digit delivery code.')
  }
  const parsed = proofSchema.safeParse(body)
  if (!parsed.success) return fail('BAD_REQUEST', 'Enter the six-digit delivery code.')
  const requestHeaders = await headers()
  try {
    return ok(
      await verifyDeliveryOtp({
        riderUserId: user.id,
        deliveryId: id,
        otp: parsed.data.otp,
        ipAddress: requestHeaders.get('x-forwarded-for')?.split(',')[0]?.trim(),
        userAgent: requestHeaders.get('user-agent') ?? undefined,
      }),
    )
  } catch (error) {
    if (error instanceof DeliveryProofError) {
      return fail(
        ['NOT_FOUND', 'NOT_ASSIGNED'].includes(error.code)
          ? 'NOT_FOUND'
          : error.code === 'RATE_LIMITED'
            ? 'CONFLICT'
            : 'BAD_REQUEST',
        error.message,
      )
    }
    console.error('[POST /api/rider/deliveries/:id/proof]', error)
    return fail('SERVER_ERROR', 'Could not verify delivery proof.')
  }
}
