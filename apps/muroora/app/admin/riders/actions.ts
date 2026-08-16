'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAdminWrite } from '@/lib/auth'
import { fromDecimal } from '@/lib/money'
import {
  assignDelivery,
  changeRiderStatus,
  createDeliveryForOrder,
  createTrustLevel,
  reconcileReturnedDelivery,
  reviewRiderIncident,
  RiderError,
  setRiderTrustAndLimit,
  updateRiderInternalNotes,
} from '@/lib/services/riders'
import {
  completeWithAuthorizedException,
  DeliveryProofError,
} from '@/lib/services/delivery-proof'

export type RiderFormState = { error?: string; message?: string }

const refresh = (riderId?: string) => {
  revalidatePath('/admin/riders')
  if (riderId) revalidatePath(`/admin/riders/${riderId}`)
}

const messageFor = (error: unknown) => {
  if (error instanceof RiderError || error instanceof DeliveryProofError) return error.message
  console.error('[admin rider action]', error)
  return 'That change could not be saved.'
}

const trustLevelInput = z.object({
  level: z.coerce.number().int().min(1).max(4),
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300).optional(),
  maximumExposure: z.string().trim().min(1),
  currency: z.enum(['USD', 'ZWL']),
}).strict()

export async function createTrustLevelAction(
  _previous: RiderFormState,
  formData: FormData,
): Promise<RiderFormState> {
  const admin = await requireAdminWrite()
  const parsed = trustLevelInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    const amount = fromDecimal(parsed.data.maximumExposure, parsed.data.currency).amount
    await createTrustLevel({ ...parsed.data, maxExposureAmount: amount }, admin.id)
    refresh()
    return { message: `Trust level ${parsed.data.level} saved.` }
  } catch (error) {
    return { error: messageFor(error) }
  }
}

const statusInput = z.object({
  riderId: z.string().uuid(),
  status: z.enum([
    'UNDER_REVIEW', 'VERIFICATION_COMPLETE', 'CONTRACT_CONFIRMED', 'APPROVED',
    'ACTIVE', 'REJECTED', 'RESTRICTED', 'SUSPENDED', 'INACTIVE',
  ]),
  verificationStatus: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'VERIFIED', 'NEEDS_INFORMATION', 'EXPIRED']),
  reason: z.string().trim().min(3).max(500),
}).strict()

export async function changeRiderStatusAction(
  _previous: RiderFormState,
  formData: FormData,
): Promise<RiderFormState> {
  const admin = await requireAdminWrite()
  const parsed = statusInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    await changeRiderStatus(parsed.data, admin.id)
    refresh(parsed.data.riderId)
    return { message: 'Rider status and access were updated.' }
  } catch (error) {
    return { error: messageFor(error) }
  }
}

const trustInput = z.object({
  riderId: z.string().uuid(),
  trustLevelId: z.string().uuid(),
  exposureOverride: z.string().trim().optional(),
  currency: z.enum(['USD', 'ZWL']),
  reason: z.string().trim().min(3).max(500),
}).strict()

export async function setRiderTrustAction(
  _previous: RiderFormState,
  formData: FormData,
): Promise<RiderFormState> {
  const admin = await requireAdminWrite()
  const parsed = trustInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    const override = parsed.data.exposureOverride
      ? fromDecimal(parsed.data.exposureOverride, parsed.data.currency).amount
      : null
    await setRiderTrustAndLimit(
      { riderId: parsed.data.riderId, trustLevelId: parsed.data.trustLevelId, maxExposureOverrideAmount: override, reason: parsed.data.reason },
      admin.id,
    )
    refresh(parsed.data.riderId)
    return { message: 'Trust and exposure limit were updated.' }
  } catch (error) {
    return { error: messageFor(error) }
  }
}

const notesInput = z.object({
  riderId: z.string().uuid(),
  notes: z.string().trim().max(2000),
}).strict()

export async function updateRiderNotesAction(
  _previous: RiderFormState,
  formData: FormData,
): Promise<RiderFormState> {
  const admin = await requireAdminWrite()
  const parsed = notesInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    await updateRiderInternalNotes(parsed.data.riderId, parsed.data.notes, admin.id)
    refresh(parsed.data.riderId)
    return { message: 'Internal notes saved.' }
  } catch (error) {
    return { error: messageFor(error) }
  }
}

const deliveryInput = z.object({
  orderId: z.string().uuid(),
  earning: z.string().trim().optional(),
  currency: z.enum(['USD', 'ZWL']),
  requiredVehicleType: z.enum(['', 'BICYCLE', 'MOTORBIKE', 'CAR']),
}).strict()

export async function createDeliveryAction(
  _previous: RiderFormState,
  formData: FormData,
): Promise<RiderFormState> {
  const admin = await requireAdminWrite()
  const parsed = deliveryInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    await createDeliveryForOrder({
      orderId: parsed.data.orderId,
      riderEarningAmount: parsed.data.earning ? fromDecimal(parsed.data.earning, parsed.data.currency).amount : undefined,
      requiredVehicleType: parsed.data.requiredVehicleType || undefined,
    }, admin.id)
    refresh()
    return { message: 'Delivery record created.' }
  } catch (error) {
    return { error: messageFor(error) }
  }
}

const assignmentInput = z.object({
  deliveryId: z.string().uuid(),
  riderId: z.string().uuid(),
  overrideReason: z.string().trim().max(500).optional(),
}).strict()

export async function assignDeliveryAction(
  _previous: RiderFormState,
  formData: FormData,
): Promise<RiderFormState> {
  const admin = await requireAdminWrite()
  const parsed = assignmentInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    await assignDelivery(parsed.data, admin.id)
    refresh(parsed.data.riderId)
    return { message: 'Delivery offered to the rider.' }
  } catch (error) {
    return { error: messageFor(error) }
  }
}

const exceptionInput = z.object({
  deliveryId: z.string().uuid(),
  riderId: z.string().uuid(),
  reason: z.string().trim().min(10).max(1000),
}).strict()

export async function completeDeliveryExceptionAction(
  _previous: RiderFormState,
  formData: FormData,
): Promise<RiderFormState> {
  const admin = await requireAdminWrite()
  const parsed = exceptionInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    await completeWithAuthorizedException({ deliveryId: parsed.data.deliveryId, adminId: admin.id, reason: parsed.data.reason })
    refresh(parsed.data.riderId)
    return { message: 'Delivery closed under an authorized exception.' }
  } catch (error) {
    return { error: messageFor(error) }
  }
}

export async function reconcileReturnAction(
  _previous: RiderFormState,
  formData: FormData,
): Promise<RiderFormState> {
  const admin = await requireAdminWrite()
  const parsed = exceptionInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    await reconcileReturnedDelivery(parsed.data.deliveryId, admin.id, parsed.data.reason)
    refresh(parsed.data.riderId)
    return { message: 'Returned goods and exposure reconciled.' }
  } catch (error) {
    return { error: messageFor(error) }
  }
}

const incidentInput = z.object({
  incidentId: z.string().uuid(),
  riderId: z.string().uuid(),
  status: z.enum(['UNDER_REVIEW', 'RESOLVED', 'CLOSED']),
  resolutionNote: z.string().trim().min(3).max(1000),
}).strict()

export async function reviewIncidentAction(
  _previous: RiderFormState,
  formData: FormData,
): Promise<RiderFormState> {
  const admin = await requireAdminWrite()
  const parsed = incidentInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    await reviewRiderIncident(parsed.data, admin.id)
    refresh(parsed.data.riderId)
    return { message: 'Incident review saved.' }
  } catch (error) {
    return { error: messageFor(error) }
  }
}
