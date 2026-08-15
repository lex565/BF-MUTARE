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

import { id, softDelete, storeId, timestamps } from './_shared'

/**
 * Identity, roles and addresses.
 *
 * Auth itself is Supabase's. `users.authId` points at `auth.users.id` there;
 * this table holds the application's own view of a person — their roles, their
 * addresses, their saved recipients. Keeping them separate means auth can be
 * swapped without touching the domain.
 */

/**
 * Roles, exactly as the brief lists them.
 *
 * MERCHANT is declared here but never granted in version 1. The brief is
 * explicit: design the database so it can be added later, do not expose it
 * now. Adding a value to a Postgres enum later is cheap; reshaping every
 * permission check is not.
 */
export const roleEnum = pgEnum('role', [
  'CUSTOMER',
  'SHOP_STAFF',
  'ADMIN',
  'RIDER',
  'SUPER_ADMIN',
  'MERCHANT', // reserved — not granted in v1
])

export const users = pgTable(
  'users',
  {
    id: id(),
    /** Supabase `auth.users.id`. Null for records created by staff on behalf
     *  of a walk-in customer who has never signed in. */
    authId: uuid('auth_id').unique(),
    fullName: text('full_name'),
    email: text('email'),
    /** E.164, e.g. +263771234567. Normalised on write, never as typed. */
    phone: text('phone'),
    /** Where the buyer is. Diaspora buyers are the point of this business. */
    countryCode: text('country_code'),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [
    index('users_email_idx').on(t.email),
    index('users_phone_idx').on(t.phone),
  ],
)

/**
 * Role grants.
 *
 * A join table rather than a column on `users`, because these genuinely
 * overlap: the shop owner is ADMIN and also places orders as a CUSTOMER, and a
 * staff member may ride deliveries at the weekend. A single role column forces
 * a second account, which then splits their order history.
 *
 * Scoped by store so a future merchant's staff cannot be granted rights over
 * another merchant's orders.
 */
export const userRoles = pgTable(
  'user_roles',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull(),
    storeId: storeId(),
    grantedBy: uuid('granted_by').references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    unique('user_roles_unique').on(t.userId, t.role, t.storeId),
    index('user_roles_user_idx').on(t.userId),
  ],
)

/** Delivery addresses saved to an account. */
export const addresses = pgTable(
  'addresses',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    label: text('label'),
    recipientName: text('recipient_name').notNull(),
    /** Zimbabwe number for the person receiving. Not the buyer's number. */
    recipientPhone: text('recipient_phone').notNull(),
    line1: text('line1').notNull(),
    line2: text('line2'),
    /** Dangamvura, Chikanga, Yeovil — how addresses actually work here. */
    suburb: text('suburb').notNull(),
    city: text('city').notNull().default('Mutare'),
    /** Free text. Most of Mutare has no street numbering a courier can use. */
    directions: text('directions'),
    latitude: text('latitude'),
    longitude: text('longitude'),
    isDefault: boolean('is_default').notNull().default(false),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [index('addresses_user_idx').on(t.userId)],
)

/**
 * Saved recipients — the diaspora feature, made concrete.
 *
 * The brief's own examples: "Mom - Dangamvura", "Brother - Chikanga". Someone
 * in Leeds buying groceries for their mother every month should not retype her
 * address each time, and the saved label is what makes the checkout feel like
 * it understands the relationship rather than just an address book.
 */
export const savedRecipients = pgTable(
  'saved_recipients',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** "Mom", "Brother", "Gogo" — the buyer's own words. */
    label: text('label').notNull(),
    fullName: text('full_name').notNull(),
    phone: text('phone').notNull(),
    addressId: uuid('address_id').references(() => addresses.id),
    relationship: text('relationship'),
    alternativeContactName: text('alternative_contact_name'),
    alternativeContactPhone: text('alternative_contact_phone'),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    ...timestamps(),
    ...softDelete(),
  },
  (t) => [index('saved_recipients_user_idx').on(t.userId)],
)

export const usersRelations = relations(users, ({ many }) => ({
  roles: many(userRoles),
  addresses: many(addresses),
  savedRecipients: many(savedRecipients),
}))

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
}))

export const addressesRelations = relations(addresses, ({ one }) => ({
  user: one(users, { fields: [addresses.userId], references: [users.id] }),
}))

export const savedRecipientsRelations = relations(savedRecipients, ({ one }) => ({
  user: one(users, { fields: [savedRecipients.userId], references: [users.id] }),
  address: one(addresses, {
    fields: [savedRecipients.addressId],
    references: [addresses.id],
  }),
}))
