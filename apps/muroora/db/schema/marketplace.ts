import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import { id, softDelete, timestamps } from './_shared'
import { products, stores } from './catalogue'
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
  'EDUCATION',
  'BEAUTY',
  'AUTOMOTIVE',
  'HOME_SERVICES',
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
    /**
     * MUR-BIZ-0001. Issued by a database DEFAULT calling
     * `next_business_public_id()`, which draws from a sequence - atomic, and
     * never derived by counting rows.
     *
     * `.$defaultFn` is NOT used, and must not be: that would generate the ID
     * in JavaScript and two simultaneous approvals would race for the same
     * number. This marks the column as having a default purely so drizzle
     * treats it as optional on insert and lets Postgres do the work.
     */
    publicId: text('public_id')
      .notNull()
      .unique()
      .default(sql`next_business_public_id()`),
    /** The merchant's own shop, when it has one. Null is legitimate. */
    storeId: uuid('store_id').references(() => stores.id),

    name: text('name').notNull(),
    slug: text('slug').notNull().unique(),
    summary: text('summary'),
    kind: businessKindEnum('kind').notNull().default('RETAIL'),
    status: businessStatusEnum('status').notNull().default('DRAFT'),

    city: text('city').notNull().default('Mutare'),
    logoPath: text('logo_path'),

    /** Public links deliberately supplied by the business owner. These are
     * separate from private application contact details. */
    websiteUrl: text('website_url'),
    whatsappNumber: text('whatsapp_number'),
    faviconPath: text('favicon_path'),

    /**
     * NOT PUBLIC. Must be omitted from any public payload until a contact
     * release has been recorded. Selecting these columns into a marketplace
     * response is the mistake this comment exists to prevent.
     */
    contactPhone: text('contact_phone'),
    contactEmail: text('contact_email'),

    isFounding: boolean('is_founding').notNull().default(false),
    foundedAt: timestamp('founded_at', { withTimezone: true }),

    /**
     * Verification: somebody at Musuwo saw this business's licence.
     *
     * THAT IS ALL IT MEANS. Not a quality rating, not a recommendation, not a
     * measure of service. A customer reads the badge as "this business is real
     * and can be found again if something goes wrong", and it must stay
     * exactly that size.
     *
     * A database CHECK requires verifiedAt, verifiedBy and licenceNumber
     * together, so no code path can produce a badge by setting one field and
     * forgetting the others.
     *
     * `licenceNumber` is shown to REVIEWERS ONLY. The public badge says
     * "checked"; it does not republish somebody's registration details.
     * `licenceDocumentPath` is a path in a private bucket, never a URL.
     */
    licenceNumber: text('licence_number'),
    licenceDocumentPath: text('licence_document_path'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    verifiedBy: uuid('verified_by').references(() => users.id),

    reviewedBy: uuid('reviewed_by').references(() => users.id),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    reviewNote: text('review_note'),

    createdBy: uuid('created_by').references(() => users.id),

    /**
     * The application this business was created from.
     *
     * THIS COLUMN IS WHAT MAKES APPROVAL SAFE TO CLICK TWICE. A unique index
     * covers it, so a second approval of the same application cannot insert a
     * second business - the database refuses before the service has to be
     * clever about it.
     */
    applicationId: uuid('application_id'),

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

    summary: text('summary'),
    address: text('address'),
    whatsapp: text('whatsapp'),

    /**
     * The type-specific answers, as asked. A boarding house is asked about
     * rooms and a tutor about subjects; nine sets of columns would mean a
     * migration every time a question changes wording.
     */
    details: jsonb('details').$type<Record<string, unknown> | null>(),

    /** Who is reviewing it. Soft - see claimApplication for why not a lock. */
    assignedTo: uuid('assigned_to').references(() => users.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),

    submittedAt: timestamp('submitted_at', { withTimezone: true }),

    /** What the reviewer asked for, and by when. Cleared on resubmission. */
    infoRequested: text('info_requested'),
    infoDueAt: timestamp('info_due_at', { withTimezone: true }),

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

/**
 * Everything that has happened to an application.
 *
 * Append only, enforced by DO INSTEAD NOTHING rules in migration 0011. A
 * status column alone cannot answer "was this rejected before?", which is
 * precisely what a reviewer needs to know.
 */
export const businessApplicationEvents = pgTable(
  'business_application_events',
  {
    id: id(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => businessApplications.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id),
    /** SUBMITTED, CLAIMED, RELEASED, INFO_REQUESTED, RESUBMITTED, APPROVED,
     *  REJECTED, NOTE. */
    event: text('event').notNull(),
    fromStatus: businessStatusEnum('from_status'),
    toStatus: businessStatusEnum('to_status'),
    message: text('message'),
    /**
     * Reviewer-only. NEVER select this column into anything the applicant
     * sees - `applicantTimeline` filters it out and is the only function that
     * should be building an applicant-facing history.
     */
    internal: boolean('internal').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('business_application_events_app_idx').on(t.applicationId, t.createdAt),
  ],
)

/**
 * Uploaded verification.
 *
 * The row is the permission record. The file is in a PRIVATE bucket and
 * `path` is a path, never a URL - if a URL turns up in that column, somebody
 * has made the bucket public.
 */
export const businessApplicationDocuments = pgTable(
  'business_application_documents',
  {
    id: id(),
    applicationId: uuid('application_id')
      .notNull()
      .references(() => businessApplications.id, { onDelete: 'cascade' }),
    uploadedBy: uuid('uploaded_by').references(() => users.id),
    /** ID_DOCUMENT, BUSINESS_REGISTRATION, PROOF_OF_ADDRESS, LOGO,
     *  PREMISES_PHOTO. */
    kind: text('kind').notNull(),
    path: text('path').notNull(),
    mimeType: text('mime_type'),
    sizeBytes: integer('size_bytes'),
    originalName: text('original_name'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('business_application_documents_app_idx').on(t.applicationId)],
)

/** Signed-in browsing signals used for private, first-party recommendations. */
export const marketplaceProductViews = pgTable(
  'marketplace_product_views',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    productId: uuid('product_id')
      .notNull()
      .references(() => products.id, { onDelete: 'cascade' }),
    viewedAt: timestamp('viewed_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('marketplace_product_views_user_idx').on(t.userId, t.viewedAt),
    index('marketplace_product_views_product_idx').on(t.productId),
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
