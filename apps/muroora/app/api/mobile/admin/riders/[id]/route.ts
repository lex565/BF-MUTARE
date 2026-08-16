import { z } from 'zod'

import { changeRiderStatus, RiderError } from '@/lib/services/riders'
import { mobileAdmin, mobileFail, mobileOk, mobileOptions } from '../../../_lib'

export const OPTIONS = mobileOptions

const inputSchema = z.object({
  status: z.enum(['UNDER_REVIEW', 'VERIFICATION_COMPLETE', 'CONTRACT_CONFIRMED', 'APPROVED', 'ACTIVE', 'REJECTED', 'RESTRICTED', 'SUSPENDED', 'INACTIVE']),
  verificationStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'VERIFIED', 'NEEDS_INFORMATION', 'EXPIRED']),
  reason: z.string().trim().min(3).max(500),
}).strict()

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const admin = await mobileAdmin(request)
  if (!admin) return mobileFail('FORBIDDEN', 'Administrator access is required.', 403)
  let body: unknown
  try { body = await request.json() } catch { return mobileFail('BAD_REQUEST', 'Expected a rider decision.', 400) }
  const parsed = inputSchema.safeParse(body)
  if (!parsed.success) return mobileFail('BAD_REQUEST', parsed.error.issues[0].message, 400)
  const { id } = await params
  try {
    const rider = await changeRiderStatus({ riderId: id, ...parsed.data }, admin.id)
    return mobileOk({ id: rider.id, accountStatus: rider.accountStatus, verificationStatus: rider.verificationStatus })
  } catch (error) {
    if (error instanceof RiderError) return mobileFail('CONFLICT', error.message, 409)
    console.error('[PATCH /api/mobile/admin/riders/:id]', error)
    return mobileFail('SERVER_ERROR', 'Could not update the rider.', 500)
  }
}
