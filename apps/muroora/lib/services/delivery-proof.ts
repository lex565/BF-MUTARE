import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'

import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import {
  auditLog,
  custodyEvents,
  deliveries,
  deliveryProofAttempts,
  deliveryProofs,
  riderEarningEvents,
  riderExposureEvents,
  riderIncidents,
  riderProfiles,
} from '@/db/schema'
import { recordOrderEvent } from '@/lib/services/orders'
import { getRiderByUserId } from '@/lib/services/riders'
import { exposureAfterCustodyChange } from '@/lib/services/rider-policy'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!
const OTP_TTL_MS = 10 * 60 * 1000
const OTP_MAX_ATTEMPTS = 5
const OTP_MIN_ATTEMPT_INTERVAL_MS = 3_000

export class DeliveryProofError extends Error {
  constructor(
    public readonly code:
      | 'NOT_FOUND'
      | 'NOT_ASSIGNED'
      | 'NOT_READY'
      | 'INVALID_OTP'
      | 'EXPIRED'
      | 'LOCKED'
      | 'RATE_LIMITED'
      | 'ALREADY_CLOSED'
      | 'FEATURE_DISABLED',
    message: string,
  ) {
    super(message)
    this.name = 'DeliveryProofError'
  }
}

const otpDigest = (otp: string, salt: string): Buffer =>
  scryptSync(otp, salt, 32)

const encodeOtp = (otp: string): string => {
  const salt = randomBytes(16).toString('hex')
  return `scrypt:${salt}:${otpDigest(otp, salt).toString('hex')}`
}

const matchesOtp = (otp: string, encoded: string): boolean => {
  const [algorithm, salt, digestHex] = encoded.split(':')
  if (algorithm !== 'scrypt' || !salt || !digestHex) return false
  const expected = Buffer.from(digestHex, 'hex')
  const actual = otpDigest(otp, salt)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

/**
 * Server-only. The returned OTP is for the notification adapter, never an API
 * response. Until a provider is selected, verification tests call this
 * directly and production callers must refuse to issue an undeliverable OTP.
 */
export async function issueDeliveryOtpForNotification(
  deliveryId: string,
  actorId: string,
): Promise<{ proofId: string; otp: string; expiresAt: Date }> {
  return db.transaction(async (tx) => {
    const [delivery] = await tx
      .select()
      .from(deliveries)
      .where(eq(deliveries.id, deliveryId))
      .for('update')
    if (!delivery) throw new DeliveryProofError('NOT_FOUND', 'No such delivery.')
    if (delivery.custodyState !== 'IN_RIDER_CUSTODY') {
      throw new DeliveryProofError('NOT_READY', 'OTP is issued only after custody handover.')
    }
    if (['DELIVERED', 'RETURNED', 'CANCELLED'].includes(delivery.status)) {
      throw new DeliveryProofError('ALREADY_CLOSED', 'Delivery is already closed.')
    }

    await tx
      .update(deliveryProofs)
      .set({ status: 'EXPIRED', updatedAt: new Date() })
      .where(
        and(
          eq(deliveryProofs.deliveryId, delivery.id),
          eq(deliveryProofs.proofType, 'OTP'),
          eq(deliveryProofs.status, 'PENDING'),
        ),
      )

    const otp = randomInt(0, 1_000_000).toString().padStart(6, '0')
    const expiresAt = new Date(Date.now() + OTP_TTL_MS)
    const [proof] = await tx
      .insert(deliveryProofs)
      .values({
        deliveryId: delivery.id,
        proofType: 'OTP',
        otpHash: encodeOtp(otp),
        expiresAt,
        maxAttempts: OTP_MAX_ATTEMPTS,
      })
      .returning({ id: deliveryProofs.id })
    await tx.insert(auditLog).values({
      storeId: delivery.storeId,
      actorId,
      actorRole: 'SYSTEM',
      action: 'DELIVERY_OTP_ISSUED',
      entityType: 'delivery',
      entityId: delivery.id,
      changes: { proofId: proof.id, expiresAt: expiresAt.toISOString() },
    })
    return { proofId: proof.id, otp, expiresAt }
  })
}

async function closeDeliveryAfterVerifiedProof(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: {
    deliveryId: string
    proofId: string
    riderUserId: string
    actorId?: string
    actorType?: 'RIDER' | 'ADMIN'
    actorRole?: 'RIDER' | 'ADMIN'
  },
) {
  const actorId = params.actorId ?? params.riderUserId
  const actorType = params.actorType ?? 'RIDER'
  const actorRole = params.actorRole ?? 'RIDER'
  const rider = await getRiderByUserId(params.riderUserId, tx)
  const [delivery] = await tx
    .select()
    .from(deliveries)
    .where(and(eq(deliveries.id, params.deliveryId), eq(deliveries.riderId, rider.id)))
    .for('update')
  if (!delivery) throw new DeliveryProofError('NOT_ASSIGNED', 'This delivery is not assigned to you.')
  if (delivery.custodyState === 'CUSTODY_CLOSED' && delivery.status === 'DELIVERED') {
    return { alreadyCompleted: true }
  }
  if (delivery.custodyState !== 'IN_RIDER_CUSTODY') {
    throw new DeliveryProofError('NOT_READY', 'Delivery is not in rider custody.')
  }

  const [lockedRider] = await tx
    .select()
    .from(riderProfiles)
    .where(eq(riderProfiles.id, rider.id))
    .for('update')
  if (!lockedRider) throw new DeliveryProofError('NOT_FOUND', 'No such rider.')
  let exposureAfter: bigint
  try {
    exposureAfter = exposureAfterCustodyChange(
      lockedRider.currentExposureAmount,
      -delivery.merchandiseValueAmount,
    )
  } catch {
    throw new DeliveryProofError('NOT_READY', 'Exposure ledger would become negative; admin review is required.')
  }
  const now = new Date()

  await tx
    .update(riderProfiles)
    .set({
      currentExposureAmount: exposureAfter,
      availability: 'AVAILABLE',
      completedDeliveries: lockedRider.completedDeliveries + 1,
      updatedAt: now,
    })
    .where(eq(riderProfiles.id, rider.id))
  await tx
    .update(deliveries)
    .set({ status: 'DELIVERED', custodyState: 'CUSTODY_CLOSED', deliveredAt: now, closedAt: now, updatedAt: now })
    .where(eq(deliveries.id, delivery.id))

  await tx.insert(riderExposureEvents).values({
    riderId: rider.id,
    deliveryId: delivery.id,
    eventType: 'DELIVERY_CONFIRMED',
    amountChange: -delivery.merchandiseValueAmount,
    amountBefore: lockedRider.currentExposureAmount,
    amountAfter: exposureAfter,
    currency: delivery.currency,
    actorId,
    idempotencyKey: `delivery:${delivery.id}:exposure-delivered`,
    reason: `Verified proof ${params.proofId}`,
  })
  await tx.insert(custodyEvents).values([
    {
      deliveryId: delivery.id,
      orderId: delivery.orderId,
      riderId: rider.id,
      storeId: delivery.storeId,
      actorId,
      actorType,
      previousState: 'IN_RIDER_CUSTODY' as const,
      newState: 'DELIVERY_CONFIRMED' as const,
      merchandiseValueAmount: delivery.merchandiseValueAmount,
      currency: delivery.currency,
      proofReference: params.proofId,
      idempotencyKey: `delivery:${delivery.id}:delivery-confirmed`,
    },
    {
      deliveryId: delivery.id,
      orderId: delivery.orderId,
      riderId: rider.id,
      storeId: delivery.storeId,
      actorId: params.riderUserId,
      actorType: 'SYSTEM',
      previousState: 'DELIVERY_CONFIRMED' as const,
      newState: 'CUSTODY_CLOSED' as const,
      merchandiseValueAmount: delivery.merchandiseValueAmount,
      currency: delivery.currency,
      proofReference: params.proofId,
      idempotencyKey: `delivery:${delivery.id}:custody-closed`,
    },
  ])
  await recordOrderEvent(
    {
      orderId: delivery.orderId,
      eventType: 'DELIVERY_CONFIRMED',
      newStatus: 'DELIVERED',
      actorType,
      actorId,
      metadata: { proofId: params.proofId, publicRiderId: rider.publicRiderId },
    },
    tx,
  )

  if (delivery.riderEarningAmount != null && delivery.riderEarningAmount > 0n) {
    const [{ balance }] = await tx
      .select({ balance: sql<bigint>`coalesce(sum(${riderEarningEvents.amount}), 0)::bigint` })
      .from(riderEarningEvents)
      .where(and(eq(riderEarningEvents.riderId, rider.id), eq(riderEarningEvents.currency, delivery.currency)))
    await tx.insert(riderEarningEvents).values({
      riderId: rider.id,
      deliveryId: delivery.id,
      type: 'DELIVERY_EARNING',
      amount: delivery.riderEarningAmount,
      balanceBefore: balance,
      balanceAfter: balance + delivery.riderEarningAmount,
      currency: delivery.currency,
      actorId,
      idempotencyKey: `delivery:${delivery.id}:earning`,
      note: 'Credited after verified delivery completion.',
    })
  }
  await tx.insert(auditLog).values({
    storeId: delivery.storeId,
    actorId,
    actorRole,
    action: 'DELIVERY_CONFIRMED_AND_CUSTODY_CLOSED',
    entityType: 'delivery',
    entityId: delivery.id,
    changes: { proofId: params.proofId, exposureAfter: exposureAfter.toString() },
  })
  return { alreadyCompleted: false }
}

export async function verifyDeliveryOtp(input: {
  riderUserId: string
  deliveryId: string
  otp: string
  ipAddress?: string
  userAgent?: string
}) {
  if (!/^\d{6}$/.test(input.otp)) {
    throw new DeliveryProofError('INVALID_OTP', 'Enter the six-digit code.')
  }
  const result = await db.transaction(async (tx) => {
    const rider = await getRiderByUserId(input.riderUserId, tx)
    const [delivery] = await tx
      .select({ id: deliveries.id, riderId: deliveries.riderId, storeId: deliveries.storeId })
      .from(deliveries)
      .where(eq(deliveries.id, input.deliveryId))
    if (!delivery || delivery.riderId !== rider.id) {
      throw new DeliveryProofError('NOT_ASSIGNED', 'This delivery is not assigned to you.')
    }

    const [proof] = await tx
      .select()
      .from(deliveryProofs)
      .where(and(eq(deliveryProofs.deliveryId, delivery.id), eq(deliveryProofs.proofType, 'OTP')))
      .orderBy(desc(deliveryProofs.createdAt))
      .limit(1)
      .for('update')
    if (!proof?.otpHash) throw new DeliveryProofError('NOT_FOUND', 'No delivery code has been issued.')
    if (proof.status === 'VERIFIED') {
      return { verified: true as const, alreadyVerified: true as const }
    }
    if (proof.lockedAt || proof.attemptCount >= proof.maxAttempts) {
      throw new DeliveryProofError('LOCKED', 'Too many attempts. Contact the shop for review.')
    }
    if (!proof.expiresAt || proof.expiresAt.getTime() <= Date.now()) {
      await tx.update(deliveryProofs).set({ status: 'EXPIRED', updatedAt: new Date() }).where(eq(deliveryProofs.id, proof.id))
      return {
        verified: false as const,
        error: new DeliveryProofError('EXPIRED', 'This delivery code has expired.'),
      }
    }

    const [latestAttempt] = await tx
      .select({ createdAt: deliveryProofAttempts.createdAt })
      .from(deliveryProofAttempts)
      .where(eq(deliveryProofAttempts.proofId, proof.id))
      .orderBy(desc(deliveryProofAttempts.createdAt))
      .limit(1)
    if (latestAttempt && Date.now() - latestAttempt.createdAt.getTime() < OTP_MIN_ATTEMPT_INTERVAL_MS) {
      throw new DeliveryProofError('RATE_LIMITED', 'Wait a moment before trying again.')
    }

    const success = matchesOtp(input.otp, proof.otpHash)
    const attempts = proof.attemptCount + 1
    const locked = !success && attempts >= proof.maxAttempts
    await tx.insert(deliveryProofAttempts).values({
      proofId: proof.id,
      actorId: input.riderUserId,
      wasSuccessful: success,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    })
    await tx
      .update(deliveryProofs)
      .set({
        attemptCount: attempts,
        status: success ? 'VERIFIED' : locked ? 'FAILED' : 'PENDING',
        lockedAt: locked ? new Date() : null,
        verifiedAt: success ? new Date() : null,
        verifiedBy: success ? input.riderUserId : null,
        updatedAt: new Date(),
      })
      .where(eq(deliveryProofs.id, proof.id))
    await tx.insert(auditLog).values({
      storeId: delivery.storeId,
      actorId: input.riderUserId,
      actorRole: 'RIDER',
      action: success ? 'DELIVERY_OTP_VERIFIED' : 'DELIVERY_OTP_FAILED',
      entityType: 'delivery',
      entityId: delivery.id,
      changes: { proofId: proof.id, attempt: attempts, locked },
    })
    if (!success) {
      return {
        verified: false as const,
        error: new DeliveryProofError(
          locked ? 'LOCKED' : 'INVALID_OTP',
          locked ? 'Too many attempts. Contact the shop.' : 'That code is not correct.',
        ),
      }
    }

    await closeDeliveryAfterVerifiedProof(tx, {
      deliveryId: delivery.id,
      proofId: proof.id,
      riderUserId: input.riderUserId,
    })
    return { verified: true as const, alreadyVerified: false as const }
  })
  // Invalid and expired proof paths intentionally commit their attempt/status
  // ledger before the caller receives an error.
  if (!result.verified) throw result.error
  return result
}

export async function completeWithAuthorizedException(input: {
  deliveryId: string
  adminId: string
  reason: string
}) {
  if (!input.reason.trim()) throw new DeliveryProofError('NOT_READY', 'An exception reason is required.')
  return db.transaction(async (tx) => {
    const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.id, input.deliveryId)).for('update')
    if (!delivery?.riderId) throw new DeliveryProofError('NOT_ASSIGNED', 'Delivery has no rider.')
    const [rider] = await tx.select().from(riderProfiles).where(eq(riderProfiles.id, delivery.riderId))
    if (!rider) throw new DeliveryProofError('NOT_FOUND', 'No such rider.')
    const [proof] = await tx
      .insert(deliveryProofs)
      .values({
        deliveryId: delivery.id,
        proofType: 'AUTHORIZED_EXCEPTION',
        status: 'WAIVED_BY_ADMIN',
        verifiedAt: new Date(),
        verifiedBy: input.adminId,
        exceptionReason: input.reason.trim(),
      })
      .returning({ id: deliveryProofs.id })
    await closeDeliveryAfterVerifiedProof(tx, {
      deliveryId: delivery.id,
      proofId: proof.id,
      riderUserId: rider.userId,
      actorId: input.adminId,
      actorType: 'ADMIN',
      actorRole: 'ADMIN',
    })
    await tx.insert(auditLog).values({
      storeId: delivery.storeId,
      actorId: input.adminId,
      actorRole: 'ADMIN',
      action: 'DELIVERY_PROOF_EXCEPTION_AUTHORIZED',
      entityType: 'delivery',
      entityId: delivery.id,
      changes: { proofId: proof.id, reason: input.reason.trim() },
    })
    return proof
  })
}

export async function reportRiderIncident(input: {
  riderUserId: string
  deliveryId?: string
  category:
    | 'CUSTOMER_UNREACHABLE'
    | 'INCORRECT_ADDRESS'
    | 'RECIPIENT_UNAVAILABLE'
    | 'VEHICLE_BREAKDOWN'
    | 'DAMAGED_PACKAGE'
    | 'SAFETY_CONCERN'
    | 'CUSTOMER_DISPUTE'
    | 'SHOP_ISSUE'
    | 'PAYMENT_CASH_ISSUE'
    | 'OTHER'
  note: string
  evidencePath?: string
}) {
  if (!input.note.trim()) throw new DeliveryProofError('NOT_READY', 'Describe what happened.')
  return db.transaction(async (tx) => {
    const rider = await getRiderByUserId(input.riderUserId, tx)
    let orderId: string | null = null
    if (input.deliveryId) {
      const [delivery] = await tx
        .select({ orderId: deliveries.orderId, riderId: deliveries.riderId })
        .from(deliveries)
        .where(eq(deliveries.id, input.deliveryId))
      if (!delivery || delivery.riderId !== rider.id) {
        throw new DeliveryProofError('NOT_ASSIGNED', 'You can report only your own delivery.')
      }
      orderId = delivery.orderId
    }
    const [incident] = await tx
      .insert(riderIncidents)
      .values({
        deliveryId: input.deliveryId ?? null,
        orderId,
        riderId: rider.id,
        reportedBy: input.riderUserId,
        category: input.category,
        note: input.note.trim(),
        evidencePath: input.evidencePath ?? null,
      })
      .returning()
    await tx
      .update(riderProfiles)
      .set({ incidentCount: sql`${riderProfiles.incidentCount} + 1`, updatedAt: new Date() })
      .where(eq(riderProfiles.id, rider.id))
    await tx.insert(auditLog).values({
      storeId: STORE_ID,
      actorId: input.riderUserId,
      actorRole: 'RIDER',
      action: 'RIDER_INCIDENT_CREATED',
      entityType: 'rider_incident',
      entityId: incident.id,
      changes: { riderId: rider.id, deliveryId: input.deliveryId ?? null, category: input.category },
    })
    return incident
  })
}

export async function publicRiderForDelivery(deliveryId: string) {
  const [row] = await db
    .select({
      publicRiderId: riderProfiles.publicRiderId,
      displayName: riderProfiles.displayName,
      profilePhotoPath: riderProfiles.profilePhotoPath,
      vehicleType: riderProfiles.vehicleType,
      vehicleColour: riderProfiles.vehicleColour,
      vehicleRegistration: riderProfiles.vehicleRegistration,
      verificationStatus: riderProfiles.verificationStatus,
      completedDeliveries: riderProfiles.completedDeliveries,
    })
    .from(deliveries)
    .innerJoin(riderProfiles, eq(deliveries.riderId, riderProfiles.id))
    .where(eq(deliveries.id, deliveryId))
  return row ?? null
}

export async function publicRiderForOrder(orderId: string) {
  const [delivery] = await db
    .select({ id: deliveries.id })
    .from(deliveries)
    .where(eq(deliveries.orderId, orderId))
  return delivery ? publicRiderForDelivery(delivery.id) : null
}

export const sensitiveRiderVerificationEnabled = (): boolean =>
  process.env.ENABLE_SENSITIVE_RIDER_VERIFICATION === 'true'

/** Stable fingerprint for support logs without recording an OTP. */
export const proofRequestFingerprint = (deliveryId: string): string =>
  createHash('sha256').update(`delivery-proof:${deliveryId}`).digest('hex').slice(0, 16)
