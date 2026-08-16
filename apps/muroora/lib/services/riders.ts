import { randomUUID } from 'node:crypto'

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm'

import { db, type DbOrTx } from '@/db/client'
import {
  auditLog,
  custodyEvents,
  deliveries,
  deliveryOffers,
  exposureOverrides,
  orders,
  riderExposureEvents,
  riderIncidents,
  riderProfiles,
  riderStatusEvents,
  riderTrustLevels,
  userRoles,
} from '@/db/schema'
import { recordOrderEvent } from '@/lib/services/orders'
import { assignmentDecision, exposureAfterCustodyChange } from '@/lib/services/rider-policy'

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!
const ACTIVE_DELIVERY_STATUSES = [
  'ASSIGNED',
  'ACCEPTED',
  'RIDER_EN_ROUTE_TO_PICKUP',
  'RIDER_ARRIVED_PICKUP',
  'PICKED_UP',
  'EN_ROUTE_TO_CUSTOMER',
  'ARRIVED',
] as const

export class RiderError extends Error {
  constructor(
    public readonly code:
      | 'NOT_FOUND'
      | 'NOT_APPROVED'
      | 'NOT_AVAILABLE'
      | 'ACTIVE_DELIVERY'
      | 'EXPOSURE_LIMIT'
      | 'NO_EXPOSURE_LIMIT'
      | 'ILLEGAL_TRANSITION'
      | 'NOT_ASSIGNED'
      | 'CURRENCY_MISMATCH'
      | 'DUPLICATE',
    message: string,
  ) {
    super(message)
    this.name = 'RiderError'
  }
}

export async function createTrustLevel(
  input: {
    level: number
    name: string
    description?: string
    maxExposureAmount?: bigint | null
    currency?: 'USD' | 'ZWL'
  },
  actorId: string,
) {
  if (input.level < 1 || input.level > 4) {
    throw new RiderError('ILLEGAL_TRANSITION', 'Trust level must be between 1 and 4.')
  }
  if (input.maxExposureAmount != null && input.maxExposureAmount < 0n) {
    throw new RiderError('ILLEGAL_TRANSITION', 'Exposure cannot be negative.')
  }
  const [created] = await db.transaction(async (tx) => {
    const rows = await tx
      .insert(riderTrustLevels)
      .values({
        storeId: STORE_ID,
        level: input.level,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        maxExposureAmount: input.maxExposureAmount ?? null,
        currency: input.currency ?? 'USD',
      })
      .returning()
    await tx.insert(auditLog).values({
      storeId: STORE_ID,
      actorId,
      actorRole: 'ADMIN',
      action: 'RIDER_TRUST_LEVEL_CREATED',
      entityType: 'rider_trust_level',
      entityId: rows[0].id,
      changes: {
        level: input.level,
        maxExposureAmount: input.maxExposureAmount?.toString() ?? null,
      },
    })
    return rows
  })
  return created
}

export async function listTrustLevels() {
  return db
    .select()
    .from(riderTrustLevels)
    .where(eq(riderTrustLevels.storeId, STORE_ID))
    .orderBy(asc(riderTrustLevels.level))
}

export async function createRiderApplication(
  input: {
    userId: string
    displayName: string
    operationalPhone?: string
    vehicleType?: 'BICYCLE' | 'MOTORBIKE' | 'CAR'
    vehicleMakeModel?: string
    vehicleRegistration?: string
    vehicleColour?: string
  },
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: riderProfiles.id })
      .from(riderProfiles)
      .where(eq(riderProfiles.userId, input.userId))
    if (existing) throw new RiderError('DUPLICATE', 'This account already has a rider application.')

    const [profile] = await tx
      .insert(riderProfiles)
      .values({
        storeId: STORE_ID,
        userId: input.userId,
        displayName: input.displayName.trim(),
        operationalPhone: input.operationalPhone?.trim() || null,
        vehicleType: input.vehicleType ?? null,
        vehicleMakeModel: input.vehicleMakeModel?.trim() || null,
        vehicleRegistration: input.vehicleRegistration?.trim() || null,
        vehicleColour: input.vehicleColour?.trim() || null,
      })
      .returning()
    await tx.insert(riderStatusEvents).values({
      riderId: profile.id,
      actorId: input.userId,
      eventType: 'RIDER_APPLIED',
      newStatus: 'APPLICATION',
    })
    await tx.insert(auditLog).values({
      storeId: STORE_ID,
      actorId: input.userId,
      actorRole: 'CUSTOMER',
      action: 'RIDER_APPLIED',
      entityType: 'rider',
      entityId: profile.id,
      changes: { publicRiderId: profile.publicRiderId },
    })
    return profile
  })
}

export async function listRidersForAdmin() {
  return db
    .select({
      id: riderProfiles.id,
      publicRiderId: riderProfiles.publicRiderId,
      displayName: riderProfiles.displayName,
      profilePhotoPath: riderProfiles.profilePhotoPath,
      operationalPhone: riderProfiles.operationalPhone,
      vehicleType: riderProfiles.vehicleType,
      accountStatus: riderProfiles.accountStatus,
      verificationStatus: riderProfiles.verificationStatus,
      availability: riderProfiles.availability,
      trustLevel: riderTrustLevels.level,
      trustLevelName: riderTrustLevels.name,
      currentExposureAmount: riderProfiles.currentExposureAmount,
      trustExposureLimitAmount: riderTrustLevels.maxExposureAmount,
      maxExposureOverrideAmount: riderProfiles.maxExposureOverrideAmount,
      currency: riderProfiles.currency,
      completedDeliveries: riderProfiles.completedDeliveries,
      failedDeliveries: riderProfiles.failedDeliveries,
      activeDeliveries: sql<number>`(
        select count(*)::int from deliveries d
        where d.rider_id = ${riderProfiles.id}
          and d.status in ('ASSIGNED','ACCEPTED','RIDER_EN_ROUTE_TO_PICKUP','RIDER_ARRIVED_PICKUP','PICKED_UP','EN_ROUTE_TO_CUSTOMER','ARRIVED')
      )`,
      incidentCount: riderProfiles.incidentCount,
      joinedAt: riderProfiles.joinedAt,
      approvedAt: riderProfiles.approvedAt,
      restrictionReason: riderProfiles.restrictionReason,
    })
    .from(riderProfiles)
    .leftJoin(riderTrustLevels, eq(riderProfiles.trustLevelId, riderTrustLevels.id))
    .where(eq(riderProfiles.storeId, STORE_ID))
    .orderBy(desc(riderProfiles.createdAt))
}

export async function getRiderByUserId(userId: string, tx: DbOrTx = db) {
  const [rider] = await tx
    .select()
    .from(riderProfiles)
    .where(and(eq(riderProfiles.userId, userId), eq(riderProfiles.storeId, STORE_ID)))
  if (!rider) throw new RiderError('NOT_FOUND', 'No rider profile for this account.')
  return rider
}

export async function changeRiderStatus(
  input: {
    riderId: string
    status:
      | 'UNDER_REVIEW'
      | 'VERIFICATION_COMPLETE'
      | 'CONTRACT_CONFIRMED'
      | 'APPROVED'
      | 'ACTIVE'
      | 'REJECTED'
      | 'RESTRICTED'
      | 'SUSPENDED'
      | 'INACTIVE'
    reason: string
    verificationStatus?:
      | 'NOT_STARTED'
      | 'IN_PROGRESS'
      | 'VERIFIED'
      | 'NEEDS_INFORMATION'
      | 'EXPIRED'
  },
  actorId: string,
) {
  if (!input.reason.trim()) throw new RiderError('ILLEGAL_TRANSITION', 'A reason is required.')
  return db.transaction(async (tx) => {
    const [rider] = await tx
      .select()
      .from(riderProfiles)
      .where(eq(riderProfiles.id, input.riderId))
      .for('update')
    if (!rider) throw new RiderError('NOT_FOUND', 'No such rider.')

    const suspended = input.status === 'SUSPENDED'
    const blocked = suspended || input.status === 'RESTRICTED' || input.status === 'INACTIVE'
    if (input.status === 'ACTIVE') {
      const verification = input.verificationStatus ?? rider.verificationStatus
      if (verification !== 'VERIFIED') {
        throw new RiderError('NOT_APPROVED', 'Verify the rider before activating delivery access.')
      }
      if (!rider.trustLevelId) {
        throw new RiderError('NO_EXPOSURE_LIMIT', 'Set a trust level before activating delivery access.')
      }
    }
    const [updated] = await tx
      .update(riderProfiles)
      .set({
        accountStatus: input.status,
        verificationStatus: input.verificationStatus ?? rider.verificationStatus,
        availability: suspended
          ? 'SUSPENDED'
          : blocked || ['APPROVED', 'ACTIVE'].includes(input.status)
            ? 'OFFLINE'
            : rider.availability,
        approvedAt: ['APPROVED', 'ACTIVE'].includes(input.status)
          ? rider.approvedAt ?? new Date()
          : rider.approvedAt,
        approvedBy: ['APPROVED', 'ACTIVE'].includes(input.status)
          ? rider.approvedBy ?? actorId
          : rider.approvedBy,
        restrictionReason: blocked ? input.reason.trim() : null,
        updatedAt: new Date(),
      })
      .where(eq(riderProfiles.id, rider.id))
      .returning()

    if (['APPROVED', 'ACTIVE'].includes(input.status)) {
      await tx
        .insert(userRoles)
        .values({ userId: rider.userId, role: 'RIDER', storeId: STORE_ID, grantedBy: actorId })
        .onConflictDoNothing()
    }
    if (suspended || input.status === 'REJECTED' || input.status === 'INACTIVE') {
      await tx
        .delete(userRoles)
        .where(
          and(
            eq(userRoles.userId, rider.userId),
            eq(userRoles.role, 'RIDER'),
            eq(userRoles.storeId, STORE_ID),
          ),
        )
    }
    await tx.insert(riderStatusEvents).values({
      riderId: rider.id,
      actorId,
      eventType: `RIDER_${input.status}`,
      previousStatus: rider.accountStatus,
      newStatus: input.status,
      reason: input.reason.trim(),
    })
    await tx.insert(auditLog).values({
      storeId: STORE_ID,
      actorId,
      actorRole: 'ADMIN',
      action: `RIDER_${input.status}`,
      entityType: 'rider',
      entityId: rider.id,
      changes: { from: rider.accountStatus, to: input.status, reason: input.reason.trim() },
    })
    return updated
  })
}

export async function setRiderTrustAndLimit(
  input: { riderId: string; trustLevelId: string; maxExposureOverrideAmount?: bigint | null; reason: string },
  actorId: string,
) {
  if (!input.reason.trim()) throw new RiderError('ILLEGAL_TRANSITION', 'A reason is required.')
  if (input.maxExposureOverrideAmount != null && input.maxExposureOverrideAmount < 0n) {
    throw new RiderError('ILLEGAL_TRANSITION', 'Exposure cannot be negative.')
  }
  return db.transaction(async (tx) => {
    const [rider] = await tx.select().from(riderProfiles).where(eq(riderProfiles.id, input.riderId)).for('update')
    if (!rider) throw new RiderError('NOT_FOUND', 'No such rider.')
    const [level] = await tx
      .select()
      .from(riderTrustLevels)
      .where(and(eq(riderTrustLevels.id, input.trustLevelId), eq(riderTrustLevels.storeId, STORE_ID)))
    if (!level) throw new RiderError('NOT_FOUND', 'No such trust level.')
    if (level.currency !== rider.currency) throw new RiderError('CURRENCY_MISMATCH', 'Trust level currency does not match rider currency.')

    const [updated] = await tx
      .update(riderProfiles)
      .set({
        trustLevelId: level.id,
        maxExposureOverrideAmount: input.maxExposureOverrideAmount ?? null,
        updatedAt: new Date(),
      })
      .where(eq(riderProfiles.id, rider.id))
      .returning()
    await tx.insert(riderStatusEvents).values({
      riderId: rider.id,
      actorId,
      eventType: 'RIDER_TRUST_LEVEL_CHANGED',
      previousStatus: rider.accountStatus,
      newStatus: rider.accountStatus,
      previousTrustLevelId: rider.trustLevelId,
      newTrustLevelId: level.id,
      reason: input.reason.trim(),
    })
    await tx.insert(auditLog).values({
      storeId: STORE_ID,
      actorId,
      actorRole: 'ADMIN',
      action: 'RIDER_TRUST_LEVEL_CHANGED',
      entityType: 'rider',
      entityId: rider.id,
      changes: {
        from: rider.trustLevelId,
        to: level.id,
        exposureOverride: input.maxExposureOverrideAmount?.toString() ?? null,
        reason: input.reason.trim(),
      },
    })
    return updated
  })
}

export async function setRiderAvailability(userId: string, available: boolean) {
  return db.transaction(async (tx) => {
    const rider = await getRiderByUserId(userId, tx)
    if (rider.accountStatus !== 'ACTIVE' || rider.verificationStatus !== 'VERIFIED') {
      throw new RiderError('NOT_APPROVED', 'Only active, verified riders may go online.')
    }
    if (!rider.trustLevelId) throw new RiderError('NO_EXPOSURE_LIMIT', 'Management must set a trust level first.')
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(deliveries)
      .where(and(eq(deliveries.riderId, rider.id), inArray(deliveries.status, [...ACTIVE_DELIVERY_STATUSES])))
    if (!available && count > 0) throw new RiderError('ACTIVE_DELIVERY', 'Finish or resolve the active delivery first.')
    const [updated] = await tx
      .update(riderProfiles)
      .set({ availability: available ? 'AVAILABLE' : 'OFFLINE', updatedAt: new Date() })
      .where(eq(riderProfiles.id, rider.id))
      .returning()
    return updated
  })
}

export async function createDeliveryForOrder(
  input: {
    orderId: string
    riderEarningAmount?: bigint
    requiredVehicleType?: 'BICYCLE' | 'MOTORBIKE' | 'CAR'
    weightClass?: string
    volumeClass?: string
    isPerishable?: boolean
  },
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const [order] = await tx.select().from(orders).where(eq(orders.id, input.orderId)).for('update')
    if (!order) throw new RiderError('NOT_FOUND', 'No such order.')
    if (order.status !== 'READY_FOR_PICKUP') {
      throw new RiderError('ILLEGAL_TRANSITION', 'Only ready orders can become deliveries.')
    }
    const [created] = await tx
      .insert(deliveries)
      .values({
        storeId: order.storeId,
        orderId: order.id,
        merchandiseValueAmount: order.subtotalAmount,
        riderEarningAmount: input.riderEarningAmount ?? null,
        currency: order.currency,
        requiredVehicleType: input.requiredVehicleType ?? null,
        weightClass: input.weightClass?.trim() || null,
        volumeClass: input.volumeClass?.trim() || null,
        isPerishable: input.isPerishable ?? false,
      })
      .returning()
    await tx.insert(custodyEvents).values({
      deliveryId: created.id,
      orderId: order.id,
      storeId: order.storeId,
      actorId,
      actorType: 'STAFF',
      newState: 'SHOP_CUSTODY',
      merchandiseValueAmount: order.subtotalAmount,
      currency: order.currency,
      idempotencyKey: `delivery:${created.id}:shop-custody`,
    })
    await tx.insert(auditLog).values({
      storeId: order.storeId,
      actorId,
      actorRole: 'STAFF',
      action: 'DELIVERY_CREATED',
      entityType: 'delivery',
      entityId: created.id,
      changes: { orderId: order.id, merchandiseValue: order.subtotalAmount.toString() },
    })
    return created
  })
}

async function exposureLimit(riderId: string, tx: DbOrTx) {
  const [row] = await tx
    .select({
      current: riderProfiles.currentExposureAmount,
      override: riderProfiles.maxExposureOverrideAmount,
      currency: riderProfiles.currency,
      trustLimit: riderTrustLevels.maxExposureAmount,
    })
    .from(riderProfiles)
    .leftJoin(riderTrustLevels, eq(riderProfiles.trustLevelId, riderTrustLevels.id))
    .where(eq(riderProfiles.id, riderId))
  if (!row) throw new RiderError('NOT_FOUND', 'No such rider.')
  return { ...row, limit: row.override ?? row.trustLimit }
}

export async function assignDelivery(
  input: { deliveryId: string; riderId: string; overrideReason?: string },
  actorId: string,
) {
  return db.transaction(async (tx) => {
    const [rider] = await tx.select().from(riderProfiles).where(eq(riderProfiles.id, input.riderId)).for('update')
    const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.id, input.deliveryId)).for('update')
    if (!rider || !delivery) throw new RiderError('NOT_FOUND', 'Rider or delivery was not found.')
    if (rider.accountStatus !== 'ACTIVE' || rider.verificationStatus !== 'VERIFIED') {
      throw new RiderError('NOT_APPROVED', 'Only active, verified riders can receive work.')
    }
    if (rider.availability !== 'AVAILABLE') throw new RiderError('NOT_AVAILABLE', 'Rider is not available.')
    if (delivery.status !== 'CREATED') throw new RiderError('ILLEGAL_TRANSITION', 'Delivery is already assigned or closed.')
    if (delivery.currency !== rider.currency) throw new RiderError('CURRENCY_MISMATCH', 'Delivery currency does not match rider exposure currency.')
    if (delivery.requiredVehicleType && delivery.requiredVehicleType !== rider.vehicleType) {
      throw new RiderError('ILLEGAL_TRANSITION', 'The rider vehicle is not eligible for this delivery.')
    }
    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(deliveries)
      .where(and(eq(deliveries.riderId, rider.id), inArray(deliveries.status, [...ACTIVE_DELIVERY_STATUSES])))
    if (count > 0) throw new RiderError('ACTIVE_DELIVERY', 'Rider already has an active delivery.')

    const exposure = await exposureLimit(rider.id, tx)
    const decision = assignmentDecision(
      {
        accountStatus: rider.accountStatus,
        verificationStatus: rider.verificationStatus,
        availability: rider.availability,
        currentExposureAmount: exposure.current,
        maxExposureOverrideAmount: rider.maxExposureOverrideAmount,
        trustExposureLimitAmount: exposure.trustLimit,
      },
      delivery.merchandiseValueAmount,
    )
    const resulting = decision.resultingExposure
    const overLimit = !decision.allowed && ['NO_EXPOSURE_LIMIT', 'EXPOSURE_LIMIT'].includes(decision.reason)
    let overrideId: string | null = null
    if (overLimit && !input.overrideReason?.trim()) {
      throw new RiderError(
        exposure.limit == null ? 'NO_EXPOSURE_LIMIT' : 'EXPOSURE_LIMIT',
        exposure.limit == null
          ? 'No merchandise exposure limit is configured for this rider.'
          : 'This assignment would exceed the rider merchandise exposure limit.',
      )
    }
    if (overLimit) {
      const [override] = await tx
        .insert(exposureOverrides)
        .values({
          riderId: rider.id,
          deliveryId: delivery.id,
          authorizedBy: actorId,
          previousExposureAmount: exposure.current,
          resultingExposureAmount: resulting,
          configuredLimitAmount: exposure.limit,
          currency: rider.currency,
          reason: input.overrideReason!.trim(),
        })
        .returning({ id: exposureOverrides.id })
      overrideId = override.id
    }

    const now = new Date()
    const [updated] = await tx
      .update(deliveries)
      .set({
        riderId: rider.id,
        status: 'ASSIGNED',
        custodyState: 'RIDER_ASSIGNED',
        assignedBy: actorId,
        assignedAt: now,
        updatedAt: now,
      })
      .where(eq(deliveries.id, delivery.id))
      .returning()
    await tx.update(riderProfiles).set({ availability: 'OFFERED_DELIVERY', updatedAt: now }).where(eq(riderProfiles.id, rider.id))
    await tx.insert(deliveryOffers).values({
      deliveryId: delivery.id,
      riderId: rider.id,
      earningOfferedAmount: delivery.riderEarningAmount,
      currency: delivery.currency,
    })
    await tx.insert(custodyEvents).values({
      deliveryId: delivery.id,
      orderId: delivery.orderId,
      riderId: rider.id,
      storeId: delivery.storeId,
      actorId,
      actorType: 'ADMIN',
      previousState: delivery.custodyState,
      newState: 'RIDER_ASSIGNED',
      merchandiseValueAmount: delivery.merchandiseValueAmount,
      currency: delivery.currency,
      reason: overrideId ? `Exposure override ${overrideId}` : null,
      idempotencyKey: `delivery:${delivery.id}:assigned`,
    })
    await recordOrderEvent(
      {
        orderId: delivery.orderId,
        eventType: 'DRIVER_ASSIGNED',
        newStatus: 'DRIVER_ASSIGNED',
        actorType: 'ADMIN',
        actorId,
        metadata: { riderId: rider.publicRiderId, exposureOverrideId: overrideId },
      },
      tx,
    )
    await tx.insert(auditLog).values({
      storeId: STORE_ID,
      actorId,
      actorRole: 'ADMIN',
      action: overrideId ? 'DELIVERY_ASSIGNED_WITH_EXPOSURE_OVERRIDE' : 'DELIVERY_ASSIGNED',
      entityType: 'delivery',
      entityId: delivery.id,
      changes: { riderId: rider.id, overrideId },
    })
    return updated
  })
}

export async function respondToDeliveryOffer(userId: string, deliveryId: string, accept: boolean, reason?: string) {
  return db.transaction(async (tx) => {
    const rider = await getRiderByUserId(userId, tx)
    const [delivery] = await tx
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.id, deliveryId), eq(deliveries.riderId, rider.id)))
      .for('update')
    if (!delivery) throw new RiderError('NOT_ASSIGNED', 'This delivery is not assigned to you.')
    if (delivery.status !== 'ASSIGNED') throw new RiderError('ILLEGAL_TRANSITION', 'This offer is no longer open.')
    const now = new Date()
    await tx
      .update(deliveryOffers)
      .set({ status: accept ? 'ACCEPTED' : 'DECLINED', respondedAt: now, declineReason: accept ? null : reason?.trim() || null })
      .where(and(eq(deliveryOffers.deliveryId, delivery.id), eq(deliveryOffers.riderId, rider.id)))
    await tx.insert(auditLog).values({
      storeId: delivery.storeId,
      actorId: userId,
      actorRole: 'RIDER',
      action: accept ? 'DELIVERY_OFFER_ACCEPTED' : 'DELIVERY_OFFER_DECLINED',
      entityType: 'delivery',
      entityId: delivery.id,
      changes: { reason: accept ? null : reason?.trim() || null },
    })
    if (!accept) {
      await tx
        .update(deliveries)
        .set({ riderId: null, status: 'CREATED', custodyState: 'SHOP_CUSTODY', assignedBy: null, assignedAt: null, updatedAt: now })
        .where(eq(deliveries.id, delivery.id))
      await tx.update(riderProfiles).set({ availability: 'AVAILABLE', updatedAt: now }).where(eq(riderProfiles.id, rider.id))
      await tx.insert(custodyEvents).values({
        deliveryId: delivery.id,
        orderId: delivery.orderId,
        riderId: rider.id,
        storeId: delivery.storeId,
        actorId: userId,
        actorType: 'RIDER',
        previousState: 'RIDER_ASSIGNED',
        newState: 'SHOP_CUSTODY',
        merchandiseValueAmount: delivery.merchandiseValueAmount,
        currency: delivery.currency,
        reason: reason?.trim() || 'Rider declined',
        idempotencyKey: `delivery:${delivery.id}:declined:${rider.id}`,
      })
      return { accepted: false }
    }
    await tx.update(deliveries).set({ status: 'ACCEPTED', acceptedAt: now, updatedAt: now }).where(eq(deliveries.id, delivery.id))
    await tx.update(riderProfiles).set({ availability: 'ON_DELIVERY', updatedAt: now }).where(eq(riderProfiles.id, rider.id))
    return { accepted: true }
  })
}

export async function startShopHandover(deliveryId: string, staffId: string) {
  return db.transaction(async (tx) => {
    const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.id, deliveryId)).for('update')
    if (!delivery?.riderId) throw new RiderError('NOT_ASSIGNED', 'Delivery has no assigned rider.')
    if (!['ACCEPTED', 'RIDER_ARRIVED_PICKUP'].includes(delivery.status)) {
      throw new RiderError('ILLEGAL_TRANSITION', 'Rider must accept and arrive before handover.')
    }
    await tx.update(deliveries).set({ custodyState: 'HANDOVER_STARTED', status: 'RIDER_ARRIVED_PICKUP', updatedAt: new Date() }).where(eq(deliveries.id, delivery.id))
    await tx.insert(custodyEvents).values({
      deliveryId: delivery.id,
      orderId: delivery.orderId,
      riderId: delivery.riderId,
      storeId: delivery.storeId,
      actorId: staffId,
      actorType: 'STAFF',
      previousState: delivery.custodyState,
      newState: 'HANDOVER_STARTED',
      merchandiseValueAmount: delivery.merchandiseValueAmount,
      currency: delivery.currency,
      idempotencyKey: `delivery:${delivery.id}:handover-started:${randomUUID()}`,
    })
    await tx.insert(auditLog).values({
      storeId: delivery.storeId,
      actorId: staffId,
      actorRole: 'STAFF',
      action: 'RIDER_HANDOVER_STARTED',
      entityType: 'delivery',
      entityId: delivery.id,
      changes: { riderId: delivery.riderId },
    })
  })
}

export async function cancelShopHandover(deliveryId: string, staffId: string, reason: string) {
  if (!reason.trim()) throw new RiderError('ILLEGAL_TRANSITION', 'A cancellation reason is required.')
  return db.transaction(async (tx) => {
    const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.id, deliveryId)).for('update')
    if (!delivery?.riderId) throw new RiderError('NOT_ASSIGNED', 'Delivery has no assigned rider.')
    if (delivery.custodyState !== 'HANDOVER_STARTED') {
      throw new RiderError('ILLEGAL_TRANSITION', 'No handover is currently in progress.')
    }
    await tx.update(deliveries).set({ custodyState: 'RIDER_ASSIGNED', status: 'RIDER_ARRIVED_PICKUP', updatedAt: new Date() }).where(eq(deliveries.id, delivery.id))
    await tx.insert(custodyEvents).values({
      deliveryId: delivery.id,
      orderId: delivery.orderId,
      riderId: delivery.riderId,
      storeId: delivery.storeId,
      actorId: staffId,
      actorType: 'STAFF',
      previousState: 'HANDOVER_STARTED',
      newState: 'HANDOVER_CANCELLED',
      merchandiseValueAmount: delivery.merchandiseValueAmount,
      currency: delivery.currency,
      reason: reason.trim(),
      idempotencyKey: `delivery:${delivery.id}:handover-cancelled:${randomUUID()}`,
    })
    await tx.insert(auditLog).values({
      storeId: delivery.storeId,
      actorId: staffId,
      actorRole: 'STAFF',
      action: 'RIDER_HANDOVER_CANCELLED',
      entityType: 'delivery',
      entityId: delivery.id,
      changes: { reason: reason.trim() },
    })
  })
}

export async function confirmRiderHandover(userId: string, deliveryId: string) {
  return db.transaction(async (tx) => {
    const rider = await getRiderByUserId(userId, tx)
    const [delivery] = await tx
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.id, deliveryId), eq(deliveries.riderId, rider.id)))
      .for('update')
    if (!delivery) throw new RiderError('NOT_ASSIGNED', 'This delivery is not assigned to you.')
    if (delivery.custodyState === 'IN_RIDER_CUSTODY') return delivery
    if (delivery.custodyState !== 'HANDOVER_STARTED') {
      throw new RiderError('ILLEGAL_TRANSITION', 'Shop staff must start handover first.')
    }
    const exposure = await exposureLimit(rider.id, tx)
    const after = exposureAfterCustodyChange(exposure.current, delivery.merchandiseValueAmount)
    const assignmentOverride = await tx
      .select({ id: exposureOverrides.id })
      .from(exposureOverrides)
      .where(and(eq(exposureOverrides.deliveryId, delivery.id), eq(exposureOverrides.riderId, rider.id)))
    if ((exposure.limit == null || after > exposure.limit) && assignmentOverride.length === 0) {
      throw new RiderError('EXPOSURE_LIMIT', 'Handover would exceed the rider exposure limit.')
    }
    const now = new Date()
    await tx
      .update(riderProfiles)
      .set({ currentExposureAmount: after, availability: 'ON_DELIVERY', updatedAt: now })
      .where(eq(riderProfiles.id, rider.id))
    await tx
      .update(deliveries)
      .set({ status: 'PICKED_UP', custodyState: 'IN_RIDER_CUSTODY', pickedUpAt: now, updatedAt: now })
      .where(eq(deliveries.id, delivery.id))
    await tx.insert(riderExposureEvents).values({
      riderId: rider.id,
      deliveryId: delivery.id,
      eventType: 'CUSTODY_ACQUIRED',
      amountChange: delivery.merchandiseValueAmount,
      amountBefore: exposure.current,
      amountAfter: after,
      currency: delivery.currency,
      actorId: userId,
      overrideId: assignmentOverride[0]?.id ?? null,
      idempotencyKey: `delivery:${delivery.id}:exposure-acquired`,
    })
    await tx.insert(custodyEvents).values({
      deliveryId: delivery.id,
      orderId: delivery.orderId,
      riderId: rider.id,
      storeId: delivery.storeId,
      actorId: userId,
      actorType: 'RIDER',
      previousState: 'HANDOVER_STARTED',
      newState: 'IN_RIDER_CUSTODY',
      merchandiseValueAmount: delivery.merchandiseValueAmount,
      currency: delivery.currency,
      idempotencyKey: `delivery:${delivery.id}:rider-custody`,
    })
    await recordOrderEvent(
      { orderId: delivery.orderId, eventType: 'ORDER_COLLECTED', newStatus: 'OUT_FOR_DELIVERY', actorType: 'RIDER', actorId: userId },
      tx,
    )
    await tx.insert(auditLog).values({
      storeId: delivery.storeId,
      actorId: userId,
      actorRole: 'RIDER',
      action: 'RIDER_CUSTODY_ACCEPTED',
      entityType: 'delivery',
      entityId: delivery.id,
      changes: { exposureBefore: exposure.current.toString(), exposureAfter: after.toString() },
    })
    return { ...delivery, status: 'PICKED_UP' as const, custodyState: 'IN_RIDER_CUSTODY' as const }
  })
}

export async function reconcileReturnedDelivery(deliveryId: string, actorId: string, reason: string) {
  if (!reason.trim()) throw new RiderError('ILLEGAL_TRANSITION', 'A reason is required.')
  return db.transaction(async (tx) => {
    const [delivery] = await tx.select().from(deliveries).where(eq(deliveries.id, deliveryId)).for('update')
    if (!delivery?.riderId) throw new RiderError('NOT_ASSIGNED', 'Delivery has no rider.')
    if (delivery.custodyState === 'RETURNED_TO_STORE') return
    if (!['IN_RIDER_CUSTODY', 'DELIVERY_FAILED', 'RETURNING_TO_STORE', 'DAMAGED', 'DISPUTED'].includes(delivery.custodyState)) {
      throw new RiderError('ILLEGAL_TRANSITION', 'This delivery is not in returnable rider custody.')
    }
    const [rider] = await tx.select().from(riderProfiles).where(eq(riderProfiles.id, delivery.riderId)).for('update')
    if (!rider) throw new RiderError('NOT_FOUND', 'No such rider.')
    let after: bigint
    try {
      after = exposureAfterCustodyChange(rider.currentExposureAmount, -delivery.merchandiseValueAmount)
    } catch {
      throw new RiderError('ILLEGAL_TRANSITION', 'Exposure ledger would become negative.')
    }
    const now = new Date()
    await tx.update(riderProfiles).set({ currentExposureAmount: after, availability: 'AVAILABLE', updatedAt: now }).where(eq(riderProfiles.id, rider.id))
    await tx.update(deliveries).set({ status: 'RETURNED', custodyState: 'RETURNED_TO_STORE', closedAt: now, updatedAt: now }).where(eq(deliveries.id, delivery.id))
    await tx.insert(riderExposureEvents).values({
      riderId: rider.id,
      deliveryId: delivery.id,
      eventType: 'RETURNED_TO_STORE',
      amountChange: -delivery.merchandiseValueAmount,
      amountBefore: rider.currentExposureAmount,
      amountAfter: after,
      currency: delivery.currency,
      actorId,
      idempotencyKey: `delivery:${delivery.id}:exposure-returned`,
      reason: reason.trim(),
    })
    await tx.insert(custodyEvents).values({
      deliveryId: delivery.id,
      orderId: delivery.orderId,
      riderId: rider.id,
      storeId: delivery.storeId,
      actorId,
      actorType: 'STAFF',
      previousState: delivery.custodyState,
      newState: 'RETURNED_TO_STORE',
      merchandiseValueAmount: delivery.merchandiseValueAmount,
      currency: delivery.currency,
      reason: reason.trim(),
      idempotencyKey: `delivery:${delivery.id}:custody-returned`,
    })
  })
}

export async function listAvailableRiders() {
  return db
    .select({
      id: riderProfiles.id,
      publicRiderId: riderProfiles.publicRiderId,
      displayName: riderProfiles.displayName,
      vehicleType: riderProfiles.vehicleType,
      availability: riderProfiles.availability,
      trustLevel: riderTrustLevels.level,
      currentExposureAmount: riderProfiles.currentExposureAmount,
      maxExposureOverrideAmount: riderProfiles.maxExposureOverrideAmount,
      trustExposureLimitAmount: riderTrustLevels.maxExposureAmount,
      currency: riderProfiles.currency,
      completedDeliveries: riderProfiles.completedDeliveries,
    })
    .from(riderProfiles)
    .leftJoin(riderTrustLevels, eq(riderProfiles.trustLevelId, riderTrustLevels.id))
    .where(
      and(
        eq(riderProfiles.storeId, STORE_ID),
        eq(riderProfiles.accountStatus, 'ACTIVE'),
        eq(riderProfiles.verificationStatus, 'VERIFIED'),
        eq(riderProfiles.availability, 'AVAILABLE'),
      ),
    )
    .orderBy(desc(riderProfiles.completedDeliveries))
}

export async function listDispatchQueue() {
  return db
    .select({
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      orderStatus: orders.status,
      deliveryId: deliveries.id,
      deliveryStatus: deliveries.status,
      custodyState: deliveries.custodyState,
      riderId: deliveries.riderId,
      merchandiseValueAmount: orders.subtotalAmount,
      currency: orders.currency,
      deliverySuburb: orders.deliverySuburb,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(deliveries, eq(deliveries.orderId, orders.id))
    .where(
      and(
        eq(orders.storeId, STORE_ID),
        inArray(orders.status, [
          'READY_FOR_PICKUP',
          'DRIVER_ASSIGNED',
          'RIDER_AT_STORE',
          'COLLECTED',
          'OUT_FOR_DELIVERY',
          'RIDER_ARRIVED',
          'DELIVERY_FAILED',
        ]),
      ),
    )
    .orderBy(asc(orders.createdAt))
}

export async function listHandoverQueue() {
  return db
    .select({
      deliveryId: deliveries.id,
      orderNumber: orders.orderNumber,
      deliverySuburb: orders.deliverySuburb,
      status: deliveries.status,
      custodyState: deliveries.custodyState,
      merchandiseValueAmount: deliveries.merchandiseValueAmount,
      currency: deliveries.currency,
      publicRiderId: riderProfiles.publicRiderId,
      riderName: riderProfiles.displayName,
      vehicleType: riderProfiles.vehicleType,
      assignedAt: deliveries.assignedAt,
    })
    .from(deliveries)
    .innerJoin(orders, eq(deliveries.orderId, orders.id))
    .innerJoin(riderProfiles, eq(deliveries.riderId, riderProfiles.id))
    .where(
      and(
        eq(deliveries.storeId, STORE_ID),
        inArray(deliveries.status, ['ACCEPTED', 'RIDER_EN_ROUTE_TO_PICKUP', 'RIDER_ARRIVED_PICKUP']),
      ),
    )
    .orderBy(asc(deliveries.assignedAt))
}

export async function getRiderAdminDetail(riderId: string) {
  const [rider] = await db
    .select({
      id: riderProfiles.id,
      userId: riderProfiles.userId,
      publicRiderId: riderProfiles.publicRiderId,
      displayName: riderProfiles.displayName,
      profilePhotoPath: riderProfiles.profilePhotoPath,
      operationalPhone: riderProfiles.operationalPhone,
      vehicleType: riderProfiles.vehicleType,
      vehicleMakeModel: riderProfiles.vehicleMakeModel,
      vehicleRegistration: riderProfiles.vehicleRegistration,
      vehicleColour: riderProfiles.vehicleColour,
      accountStatus: riderProfiles.accountStatus,
      verificationStatus: riderProfiles.verificationStatus,
      availability: riderProfiles.availability,
      trustLevelId: riderProfiles.trustLevelId,
      trustLevel: riderTrustLevels.level,
      trustLevelName: riderTrustLevels.name,
      trustExposureLimitAmount: riderTrustLevels.maxExposureAmount,
      maxExposureOverrideAmount: riderProfiles.maxExposureOverrideAmount,
      currentExposureAmount: riderProfiles.currentExposureAmount,
      currency: riderProfiles.currency,
      completedDeliveries: riderProfiles.completedDeliveries,
      failedDeliveries: riderProfiles.failedDeliveries,
      incidentCount: riderProfiles.incidentCount,
      restrictionReason: riderProfiles.restrictionReason,
      internalNotes: riderProfiles.internalNotes,
      joinedAt: riderProfiles.joinedAt,
      approvedAt: riderProfiles.approvedAt,
    })
    .from(riderProfiles)
    .leftJoin(riderTrustLevels, eq(riderProfiles.trustLevelId, riderTrustLevels.id))
    .where(and(eq(riderProfiles.id, riderId), eq(riderProfiles.storeId, STORE_ID)))
  if (!rider) throw new RiderError('NOT_FOUND', 'No such rider.')

  const [deliveryRows, statusHistory, custodyHistory, incidents, overrides, exposureHistory] =
    await Promise.all([
      db.select().from(deliveries).where(eq(deliveries.riderId, rider.id)).orderBy(desc(deliveries.createdAt)),
      db.select().from(riderStatusEvents).where(eq(riderStatusEvents.riderId, rider.id)).orderBy(desc(riderStatusEvents.createdAt)),
      db.select().from(custodyEvents).where(eq(custodyEvents.riderId, rider.id)).orderBy(desc(custodyEvents.createdAt)),
      db.select().from(riderIncidents).where(eq(riderIncidents.riderId, rider.id)).orderBy(desc(riderIncidents.createdAt)),
      db.select().from(exposureOverrides).where(eq(exposureOverrides.riderId, rider.id)).orderBy(desc(exposureOverrides.createdAt)),
      db.select().from(riderExposureEvents).where(eq(riderExposureEvents.riderId, rider.id)).orderBy(desc(riderExposureEvents.createdAt)),
    ])
  return { rider, deliveries: deliveryRows, statusHistory, custodyHistory, incidents, overrides, exposureHistory }
}

export async function updateRiderInternalNotes(riderId: string, notes: string, actorId: string) {
  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(riderProfiles)
      .set({ internalNotes: notes.trim() || null, updatedAt: new Date() })
      .where(and(eq(riderProfiles.id, riderId), eq(riderProfiles.storeId, STORE_ID)))
      .returning({ id: riderProfiles.id })
    if (!updated) throw new RiderError('NOT_FOUND', 'No such rider.')
    await tx.insert(auditLog).values({
      storeId: STORE_ID,
      actorId,
      actorRole: 'ADMIN',
      action: 'RIDER_INTERNAL_NOTES_UPDATED',
      entityType: 'rider',
      entityId: riderId,
      changes: { notesPresent: Boolean(notes.trim()) },
    })
  })
}

export async function reviewRiderIncident(
  input: {
    incidentId: string
    status: 'UNDER_REVIEW' | 'RESOLVED' | 'CLOSED'
    resolutionNote: string
  },
  actorId: string,
) {
  if (!input.resolutionNote.trim()) {
    throw new RiderError('ILLEGAL_TRANSITION', 'Record the review decision.')
  }
  const resolved = ['RESOLVED', 'CLOSED'].includes(input.status)
  return db.transaction(async (tx) => {
    const [incident] = await tx
      .update(riderIncidents)
      .set({
        status: input.status,
        resolutionNote: input.resolutionNote.trim(),
        resolvedBy: resolved ? actorId : null,
        resolvedAt: resolved ? new Date() : null,
        updatedAt: new Date(),
      })
      .where(eq(riderIncidents.id, input.incidentId))
      .returning({ id: riderIncidents.id, riderId: riderIncidents.riderId })
    if (!incident) throw new RiderError('NOT_FOUND', 'No such incident.')
    await tx.insert(auditLog).values({
      storeId: STORE_ID,
      actorId,
      actorRole: 'ADMIN',
      action: 'RIDER_INCIDENT_REVIEWED',
      entityType: 'rider_incident',
      entityId: incident.id,
      changes: { riderId: incident.riderId, status: input.status, resolutionNote: input.resolutionNote.trim() },
    })
  })
}

export async function activeDeliveryForRider(userId: string) {
  const rider = await getRiderByUserId(userId)
  const [row] = await db
    .select({
      id: deliveries.id,
      orderId: deliveries.orderId,
      status: deliveries.status,
      custodyState: deliveries.custodyState,
      merchandiseValueAmount: deliveries.merchandiseValueAmount,
      riderEarningAmount: deliveries.riderEarningAmount,
      currency: deliveries.currency,
      weightClass: deliveries.weightClass,
      volumeClass: deliveries.volumeClass,
      isPerishable: deliveries.isPerishable,
      recipientName: orders.recipientName,
      recipientPhone: orders.recipientPhone,
      deliveryLine1: orders.deliveryLine1,
      deliveryLine2: orders.deliveryLine2,
      deliverySuburb: orders.deliverySuburb,
      deliveryCity: orders.deliveryCity,
      deliveryDirections: orders.deliveryDirections,
      orderNumber: orders.orderNumber,
    })
    .from(deliveries)
    .innerJoin(orders, eq(deliveries.orderId, orders.id))
    .where(
      and(
        eq(deliveries.riderId, rider.id),
        inArray(deliveries.status, [...ACTIVE_DELIVERY_STATUSES]),
      ),
    )
    .orderBy(desc(deliveries.assignedAt))
    .limit(1)
  if (!row) return null
  // Before acceptance the rider gets only the approximate destination area.
  // Exact recipient identity, phone and address are operationally necessary
  // only after they accept the job.
  if (row.status === 'ASSIGNED') {
    return {
      ...row,
      recipientName: null,
      recipientPhone: null,
      deliveryLine1: null,
      deliveryLine2: null,
      deliveryDirections: null,
    }
  }
  return row
}

export async function advanceRiderDelivery(
  userId: string,
  deliveryId: string,
  action: 'EN_ROUTE_TO_PICKUP' | 'ARRIVED_PICKUP' | 'EN_ROUTE_TO_CUSTOMER' | 'ARRIVED_CUSTOMER',
) {
  const transitions = {
    EN_ROUTE_TO_PICKUP: {
      from: ['ACCEPTED'],
      to: 'RIDER_EN_ROUTE_TO_PICKUP',
      orderStatus: 'DRIVER_ASSIGNED',
      event: 'RIDER_EN_ROUTE_TO_PICKUP',
    },
    ARRIVED_PICKUP: {
      from: ['ACCEPTED', 'RIDER_EN_ROUTE_TO_PICKUP'],
      to: 'RIDER_ARRIVED_PICKUP',
      orderStatus: 'RIDER_AT_STORE',
      event: 'RIDER_ARRIVED_PICKUP',
    },
    EN_ROUTE_TO_CUSTOMER: {
      from: ['PICKED_UP'],
      to: 'EN_ROUTE_TO_CUSTOMER',
      orderStatus: 'OUT_FOR_DELIVERY',
      event: 'RIDER_EN_ROUTE_TO_CUSTOMER',
    },
    ARRIVED_CUSTOMER: {
      from: ['PICKED_UP', 'EN_ROUTE_TO_CUSTOMER'],
      to: 'ARRIVED',
      orderStatus: 'RIDER_ARRIVED',
      event: 'RIDER_ARRIVED_CUSTOMER',
    },
  } as const
  const transition = transitions[action]
  return db.transaction(async (tx) => {
    const rider = await getRiderByUserId(userId, tx)
    const [delivery] = await tx
      .select()
      .from(deliveries)
      .where(and(eq(deliveries.id, deliveryId), eq(deliveries.riderId, rider.id)))
      .for('update')
    if (!delivery) throw new RiderError('NOT_ASSIGNED', 'This delivery is not assigned to you.')
    if (!(transition.from as readonly string[]).includes(delivery.status)) {
      throw new RiderError('ILLEGAL_TRANSITION', 'That delivery step is not available yet.')
    }
    const [updated] = await tx
      .update(deliveries)
      .set({ status: transition.to, updatedAt: new Date() })
      .where(eq(deliveries.id, delivery.id))
      .returning()
    await recordOrderEvent(
      {
        orderId: delivery.orderId,
        eventType: transition.event,
        newStatus: transition.orderStatus,
        actorType: 'RIDER',
        actorId: userId,
      },
      tx,
    )
    return updated
  })
}
