import { relations } from 'drizzle-orm'
import {
  boolean,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import { id, softDelete, timestamps } from './_shared'
import { stores } from './catalogue'
import { users } from './identity'

/**
 * Musuwo: the marketplace layer above the shop.
 *
 * Muroora Mart is a `business` here AND remains the `store` it always was.
 * The two are joined by `businesses.storeId` rather than merged, so the
 * marketplace can describe a merchant without owning its catalogue, and a
 * business that never had a shop can still be listed.
 *
 * See migration 0009 for the reasoning behind the lifecycle and the consent
 * flag; the comments there are the long version.
 */

export const businessStatusEnum = pgEnum('business_status', [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'NEEDS_INFORMATION',
  'APPROVED',
  'PILOT',
  'ACTIVE',
  'PAUSED',
  'SUSPENDED',
  'REJECTED',
  'INACTIVE',
])

/** What a business does. Not every SME is a grocer. */
export const businessKindEnum = pgEnum('business_kind', [
  'RETAIL',
  'FOOD',
  'ACCOMMODATION',
  'SERVICE',
  'OTHER',
])

/**
 * Authority INSIDE one business.
 *
 * Deliberately separate from the platform `role` enum. Sharing one enum is how
 * a platform administrator silently becomes every merchant's administrator,
 * and how a merchant's admin silently becomes a platform one.
 */
export const businessMemberRoleEnum = pgEnum('business_member_role', [
  'BUSINESS_OWNER',
  'BUSINESS_ADMIN',
  'BUSINESS_STAFF',
  'BUSINESS_VIEWER',
])

/** Statuses the public may see. Everything else stays private. */
export const PUBLIC_BUSINESS_STATUSES = ['ACTIVE', 'PILOT'] as const

export const businesses = pgTable(
  'businesses',
  {
    id: id(),
    /** MUR-BIZ-0001. Database default, atomic - never derived by counting. */
    publicId: text('public_id').notNull().unique(),
    /** The merchant's own shop, when it has one. Null is legitimate. */
    storeId: uuid('store_id').references(() => stores.id),

    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    summary: text('summary'),
    kind: businessKindEnum('kind').notNull().default('RETAIL'),
    status: businessStatusEnum('status').notNull().default('DRAFT'),

    city: text('city').notNull().default('Mutare'),
    logoPath: text('logo_path'),

    /**
     * NOT PUBLIC. Must be omitted from any public payload until a contact
     * release has been recorded. Selecting these columns into a marketplace
     * response is the mistake this comment exists to prevent.
     */
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),

    isFounding: boolean('is_founding').notNull().default(false),
    foundedAt: timestamp('founded_at', { withTimezone: true }),

    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),

    createdBy: uuid('created_by').references(() => users.id),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [index('businesses_status_idx').on(t.status)],
)

/**
 * Who may act for a business.
 *
 * THIS TABLE IS THE ISOLATION BOUNDARY. Resolve it on the server against the
 * signed-in user. A business id supplied by a client is a request, not a
 * permission.
 */
export const businessMemberships = pgTable(
  'business_memberships',
  {
    id: id(),
    businessId: uuid('business_id')
      .notNull()
      .references(() => businesses.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: businessMemberRoleEnum('role').notNull(),
    grantedBy: uuid('granted_by').references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    unique('business_memberships_unique').on(t.businessId, t.userId, t.role),
    index('business_memberships_user_idx').on(t.userId),
    index('business_memberships_business_idx').on(t.businessId),
  ],
)

/** Somebody asking to join. Kept apart so a rejection leaves nothing behind. */
export const businessApplications = pgTable(
  'business_applications',
  {
    id: id(),
    businessId: uuid('business_id').references(() => businesses.id),
    applicantId: uuid('applicant_id')
      .notNull()
      .references(() => users.id),
    businessName: text('business_name').notNull(),
    kind: businessKindEnum('kind').notNull().default('RETAIL'),
    city: text('city').notNull().default('Mutare'),
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),
    note: text('note'),
    status: businessStatusEnum('status').notNull().default('SUBMITTED'),
    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),
    ...timestamps(),
  },
  (t) => [
    index('business_applications_status_idx').on(t.status),
    index('business_applications_applicant_idx').on(t.applicantId),
  ],
)

export const businessesRelations = relations(businesses, ({ one, many }) => ({
  store: one(stores, { fields: [businesses.storeId], references: [stores.id] }),
  memberships: many(businessMemberships),
}))

export const businessMembershipsRelations = relations(
  businessMemberships,
  ({ one }) => ({
    business: one(businesses, {
      fields: [businessMemberships.businessId],
      references: [businesses.id],
    }),
    user: one(users, {
      fields: [businessMemberships.userId],
      references: [users.id],
    }),
  }),
)

export const businessApplicationsRelations = relations(
  businessApplications,
  ({ one }) => ({
    business: one(businesses, {
      fields: [businessApplications.businessId],
      references: [businesses.id],
    }),
    applicant: one(users, {
      fields: [businessApplications.applicantId],
      references: [users.id],
    }),
  }),
)
