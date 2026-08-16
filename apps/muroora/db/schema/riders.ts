import { relations, sql } from 'drizzle-orm'
import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import { currencyEnum, id, metadata, storeId, timestamps } from './_shared'
import { stores } from './catalogue'
import { users } from './identity'
import { orders } from './orders'

export const vehicleTypeEnum = pgEnum('rider_vehicle_type', [
  'BICYCLE',
  'MOTORBIKE',
  'CAR',
])

export const riderAccountStatusEnum = pgEnum('rider_account_status', [
  'APPLICATION',
  'UNDER_REVIEW',
  'VERIFICATION_COMPLETE',
  'CONTRACT_CONFIRMED',
  'APPROVED',
  'ACTIVE',
  'REJECTED',
  'RESTRICTED',
  'SUSPENDED',
  'INACTIVE',
])

export const riderVerificationStatusEnum = pgEnum('rider_verification_status', [
  'NOT_STARTED',
  'IN_PROGRESS',
  'VERIFIED',
  'NEEDS_INFORMATION',
  'EXPIRED',
])

export const riderAvailabilityEnum = pgEnum('rider_availability', [
  'OFFLINE',
  'AVAILABLE',
  'OFFERED_DELIVERY',
  'ON_DELIVERY',
  'PAUSED',
  'SUSPENDED',
])

export const deliveryStatusEnum = pgEnum('delivery_status', [
  'CREATED',
  'ASSIGNED',
  'ACCEPTED',
  'RIDER_EN_ROUTE_TO_PICKUP',
  'RIDER_ARRIVED_PICKUP',
  'PICKED_UP',
  'EN_ROUTE_TO_CUSTOMER',
  'ARRIVED',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
  'RETURNING_TO_STORE',
  'RETURNED',
])

export const custodyStateEnum = pgEnum('custody_state', [
  'SHOP_CUSTODY',
  'RIDER_ASSIGNED',
  'HANDOVER_STARTED',
  'IN_RIDER_CUSTODY',
  'DELIVERY_CONFIRMED',
  'CUSTODY_CLOSED',
  'HANDOVER_CANCELLED',
  'DELIVERY_FAILED',
  'RETURNING_TO_STORE',
  'RETURNED_TO_STORE',
  'DAMAGED',
  'DISPUTED',
  'LOST_PENDING_INVESTIGATION',
])

export const offerStatusEnum = pgEnum('delivery_offer_status', [
  'OFFERED',
  'ACCEPTED',
  'DECLINED',
  'EXPIRED',
  'CANCELLED',
])

export const proofTypeEnum = pgEnum('delivery_proof_type', [
  'OTP',
  'PHOTO',
  'AUTHORIZED_EXCEPTION',
])

export const proofStatusEnum = pgEnum('delivery_proof_status', [
  'PENDING',
  'VERIFIED',
  'FAILED',
  'EXPIRED',
  'WAIVED_BY_ADMIN',
])

export const incidentCategoryEnum = pgEnum('rider_incident_category', [
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
])

export const incidentStatusEnum = pgEnum('rider_incident_status', [
  'OPEN',
  'UNDER_REVIEW',
  'RESOLVED',
  'CLOSED',
])

export const exposureEventTypeEnum = pgEnum('rider_exposure_event_type', [
  'CUSTODY_ACQUIRED',
  'DELIVERY_CONFIRMED',
  'HANDOVER_CANCELLED',
  'RETURNED_TO_STORE',
  'AUTHORIZED_RECONCILIATION',
])

export const riderEarningTypeEnum = pgEnum('rider_earning_type', [
  'DELIVERY_EARNING',
  'BONUS',
  'ADJUSTMENT',
  'PAYOUT',
  'REVERSAL',
])

/** Admin-configurable tiers. Limits are intentionally data, never constants. */
export const riderTrustLevels = pgTable(
  'rider_trust_levels',
  {
    id: id(),
    storeId: storeId().references(() => stores.id),
    level: integer('level').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    maxExposureAmount: bigint('max_exposure_amount', { mode: 'bigint' }),
    currency: currencyEnum('currency').notNull().default('USD'),
    isActive: boolean('is_active').notNull().default(true),
    ...timestamps(),
  },
  (t) => [
    unique('rider_trust_levels_store_level_unique').on(t.storeId, t.level),
    check('rider_trust_level_range', sql`${t.level} between 1 and 4`),
    check(
      'rider_trust_exposure_nonnegative',
      sql`${t.maxExposureAmount} is null or ${t.maxExposureAmount} >= 0`,
    ),
  ],
)

export const riderProfiles = pgTable(
  'rider_profiles',
  {
    id: id(),
    storeId: storeId().references(() => stores.id),
    userId: uuid('user_id')
      .notNull()
      .unique()
      .references(() => users.id),
    publicRiderId: text('public_rider_id')
      .notNull()
      .unique()
      .default(sql`'MUR-R-' || lpad(nextval('rider_number_seq')::text, 4, '0')`),
    displayName: text('display_name').notNull(),
    profilePhotoPath: text('profile_photo_path'),
    operationalPhone: text('operational_phone'),
    vehicleType: vehicleTypeEnum('vehicle_type'),
    vehicleMakeModel: text('vehicle_make_model'),
    vehicleRegistration: text('vehicle_registration'),
    vehicleColour: text('vehicle_colour'),
    accountStatus: riderAccountStatusEnum('account_status')
      .notNull()
      .default('APPLICATION'),
    verificationStatus: riderVerificationStatusEnum('verification_status')
      .notNull()
      .default('NOT_STARTED'),
    availability: riderAvailabilityEnum('availability')
      .notNull()
      .default('OFFLINE'),
    trustLevelId: uuid('trust_level_id').references(() => riderTrustLevels.id),
    maxExposureOverrideAmount: bigint('max_exposure_override_amount', {
      mode: 'bigint',
    }),
    currentExposureAmount: bigint('current_exposure_amount', { mode: 'bigint' })
      .notNull()
      .default(sql`0`),
    currency: currencyEnum('currency').notNull().default('USD'),
    completedDeliveries: integer('completed_deliveries').notNull().default(0),
    failedDeliveries: integer('failed_deliveries').notNull().default(0),
    incidentCount: integer('incident_count').notNull().default(0),
    joinedAt: timestamp('joined_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: uuid('approved_by').references(() => users.id),
    restrictionReason: text('restriction_reason'),
    internalNotes: text('internal_notes'),
    ...timestamps(),
  },
  (t) => [
    index('rider_profiles_store_status_idx').on(t.storeId, t.accountStatus),
    index('rider_profiles_availability_idx').on(t.storeId, t.availability),
    check('rider_current_exposure_nonnegative', sql`${t.currentExposureAmount} >= 0`),
    check(
      'rider_override_exposure_nonnegative',
      sql`${t.maxExposureOverrideAmount} is null or ${t.maxExposureOverrideAmount} >= 0`,
    ),
  ],
)

export const riderStatusEvents = pgTable(
  'rider_status_events',
  {
    id: id(),
    riderId: uuid('rider_id').notNull().references(() => riderProfiles.id),
    actorId: uuid('actor_id').references(() => users.id),
    eventType: text('event_type').notNull(),
    previousStatus: riderAccountStatusEnum('previous_status'),
    newStatus: riderAccountStatusEnum('new_status'),
    previousTrustLevelId: uuid('previous_trust_level_id').references(
      () => riderTrustLevels.id,
    ),
    newTrustLevelId: uuid('new_trust_level_id').references(
      () => riderTrustLevels.id,
    ),
    reason: text('reason'),
    metadata: metadata(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('rider_status_events_rider_idx').on(t.riderId, t.createdAt)],
)

export const deliveries = pgTable(
  'deliveries',
  {
    id: id(),
    storeId: storeId().references(() => stores.id),
    orderId: uuid('order_id').notNull().unique().references(() => orders.id),
    riderId: uuid('rider_id').references(() => riderProfiles.id),
    status: deliveryStatusEnum('status').notNull().default('CREATED'),
    custodyState: custodyStateEnum('custody_state')
      .notNull()
      .default('SHOP_CUSTODY'),
    merchandiseValueAmount: bigint('merchandise_value_amount', { mode: 'bigint' })
      .notNull(),
    riderEarningAmount: bigint('rider_earning_amount', { mode: 'bigint' }),
    currency: currencyEnum('currency').notNull().default('USD'),
    requiredVehicleType: vehicleTypeEnum('required_vehicle_type'),
    weightClass: text('weight_class'),
    volumeClass: text('volume_class'),
    isPerishable: boolean('is_perishable').notNull().default(false),
    batchGroupId: uuid('batch_group_id'),
    assignedBy: uuid('assigned_by').references(() => users.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    pickedUpAt: timestamp('picked_up_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('deliveries_rider_status_idx').on(t.riderId, t.status),
    index('deliveries_store_status_idx').on(t.storeId, t.status),
    check('delivery_merchandise_value_nonnegative', sql`${t.merchandiseValueAmount} >= 0`),
  ],
)

export const deliveryOffers = pgTable(
  'delivery_offers',
  {
    id: id(),
    deliveryId: uuid('delivery_id').notNull().references(() => deliveries.id),
    riderId: uuid('rider_id').notNull().references(() => riderProfiles.id),
    status: offerStatusEnum('status').notNull().default('OFFERED'),
    earningOfferedAmount: bigint('earning_offered_amount', { mode: 'bigint' }),
    currency: currencyEnum('currency').notNull().default('USD'),
    offeredAt: timestamp('offered_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    declineReason: text('decline_reason'),
  },
  (t) => [
    unique('delivery_offers_delivery_rider_unique').on(t.deliveryId, t.riderId),
    index('delivery_offers_rider_status_idx').on(t.riderId, t.status),
  ],
)

/** Append-only physical custody history. */
export const custodyEvents = pgTable(
  'custody_events',
  {
    id: id(),
    deliveryId: uuid('delivery_id').notNull().references(() => deliveries.id),
    orderId: uuid('order_id').notNull().references(() => orders.id),
    riderId: uuid('rider_id').references(() => riderProfiles.id),
    storeId: storeId().references(() => stores.id),
    actorId: uuid('actor_id').references(() => users.id),
    actorType: text('actor_type').notNull(),
    previousState: custodyStateEnum('previous_state'),
    newState: custodyStateEnum('new_state').notNull(),
    merchandiseValueAmount: bigint('merchandise_value_amount', { mode: 'bigint' })
      .notNull(),
    currency: currencyEnum('currency').notNull().default('USD'),
    reason: text('reason'),
    proofReference: text('proof_reference'),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('custody_events_delivery_idx').on(t.deliveryId, t.createdAt)],
)

export const exposureOverrides = pgTable(
  'exposure_overrides',
  {
    id: id(),
    riderId: uuid('rider_id').notNull().references(() => riderProfiles.id),
    deliveryId: uuid('delivery_id').notNull().references(() => deliveries.id),
    authorizedBy: uuid('authorized_by').notNull().references(() => users.id),
    previousExposureAmount: bigint('previous_exposure_amount', { mode: 'bigint' })
      .notNull(),
    resultingExposureAmount: bigint('resulting_exposure_amount', { mode: 'bigint' })
      .notNull(),
    configuredLimitAmount: bigint('configured_limit_amount', { mode: 'bigint' }),
    currency: currencyEnum('currency').notNull().default('USD'),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('exposure_overrides_rider_idx').on(t.riderId, t.createdAt)],
)

/** Append-only exposure ledger; the profile balance is its cached projection. */
export const riderExposureEvents = pgTable(
  'rider_exposure_events',
  {
    id: id(),
    riderId: uuid('rider_id').notNull().references(() => riderProfiles.id),
    deliveryId: uuid('delivery_id').notNull().references(() => deliveries.id),
    eventType: exposureEventTypeEnum('event_type').notNull(),
    amountChange: bigint('amount_change', { mode: 'bigint' }).notNull(),
    amountBefore: bigint('amount_before', { mode: 'bigint' }).notNull(),
    amountAfter: bigint('amount_after', { mode: 'bigint' }).notNull(),
    currency: currencyEnum('currency').notNull().default('USD'),
    actorId: uuid('actor_id').references(() => users.id),
    overrideId: uuid('override_id').references(() => exposureOverrides.id),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    reason: text('reason'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('rider_exposure_events_rider_idx').on(t.riderId, t.createdAt),
    check('rider_exposure_after_nonnegative', sql`${t.amountAfter} >= 0`),
  ],
)

/** OTP hashes are server-only. No rider/customer response may select this row wholesale. */
export const deliveryProofs = pgTable(
  'delivery_proofs',
  {
    id: id(),
    deliveryId: uuid('delivery_id').notNull().references(() => deliveries.id),
    proofType: proofTypeEnum('proof_type').notNull(),
    status: proofStatusEnum('status').notNull().default('PENDING'),
    otpHash: text('otp_hash'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    attemptCount: integer('attempt_count').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    photoPath: text('photo_path'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by').references(() => users.id),
    exceptionReason: text('exception_reason'),
    metadata: metadata(),
    ...timestamps(),
  },
  (t) => [
    index('delivery_proofs_delivery_idx').on(t.deliveryId, t.status),
    check('delivery_proof_attempt_range', sql`${t.attemptCount} >= 0 and ${t.maxAttempts} > 0`),
  ],
)

export const deliveryProofAttempts = pgTable(
  'delivery_proof_attempts',
  {
    id: id(),
    proofId: uuid('proof_id').notNull().references(() => deliveryProofs.id),
    actorId: uuid('actor_id').references(() => users.id),
    wasSuccessful: boolean('was_successful').notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('delivery_proof_attempts_proof_idx').on(t.proofId, t.createdAt)],
)

export const riderIncidents = pgTable(
  'rider_incidents',
  {
    id: id(),
    deliveryId: uuid('delivery_id').references(() => deliveries.id),
    orderId: uuid('order_id').references(() => orders.id),
    riderId: uuid('rider_id').notNull().references(() => riderProfiles.id),
    reportedBy: uuid('reported_by').notNull().references(() => users.id),
    category: incidentCategoryEnum('category').notNull(),
    status: incidentStatusEnum('status').notNull().default('OPEN'),
    note: text('note').notNull(),
    evidencePath: text('evidence_path'),
    resolutionNote: text('resolution_note'),
    resolvedBy: uuid('resolved_by').references(() => users.id),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    index('rider_incidents_rider_idx').on(t.riderId, t.status),
    index('rider_incidents_delivery_idx').on(t.deliveryId, t.createdAt),
  ],
)

/** Append-only earnings ledger. Amounts are positive credits or negative debits. */
export const riderEarningEvents = pgTable(
  'rider_earning_events',
  {
    id: id(),
    riderId: uuid('rider_id').notNull().references(() => riderProfiles.id),
    deliveryId: uuid('delivery_id').references(() => deliveries.id),
    type: riderEarningTypeEnum('type').notNull(),
    amount: bigint('amount', { mode: 'bigint' }).notNull(),
    balanceBefore: bigint('balance_before', { mode: 'bigint' }).notNull(),
    balanceAfter: bigint('balance_after', { mode: 'bigint' }).notNull(),
    currency: currencyEnum('currency').notNull().default('USD'),
    actorId: uuid('actor_id').references(() => users.id),
    idempotencyKey: text('idempotency_key').notNull().unique(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('rider_earning_events_rider_idx').on(t.riderId, t.createdAt)],
)

export const riderProfilesRelations = relations(riderProfiles, ({ one, many }) => ({
  user: one(users, { fields: [riderProfiles.userId], references: [users.id] }),
  store: one(stores, { fields: [riderProfiles.storeId], references: [stores.id] }),
  trustLevel: one(riderTrustLevels, {
    fields: [riderProfiles.trustLevelId],
    references: [riderTrustLevels.id],
  }),
  deliveries: many(deliveries),
}))

export const deliveriesRelations = relations(deliveries, ({ one, many }) => ({
  order: one(orders, { fields: [deliveries.orderId], references: [orders.id] }),
  rider: one(riderProfiles, {
    fields: [deliveries.riderId],
    references: [riderProfiles.id],
  }),
  offers: many(deliveryOffers),
  custodyEvents: many(custodyEvents),
  proofs: many(deliveryProofs),
  incidents: many(riderIncidents),
}))
