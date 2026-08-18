import { relations } from 'drizzle-orm'
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import { id, timestamps } from './_shared'
import { users } from './identity'

/**
 * Musuwo platform authority.
 *
 * WHY THIS IS A SEPARATE TABLE AND NOT TWO MORE VALUES IN `role`.
 *
 * `user_roles` answers "what may this person do inside Muroora Mart's shop".
 * Every row in it carries a `store_id`, every check filters on one, and the
 * whole thing was designed when there was exactly one store. SUPER_ADMIN there
 * means "can edit this shop's products and staff". It has never meant "runs
 * Musuwo", and four people currently hold it.
 *
 * Adding PLATFORM_OWNER to that enum would have made all four of them platform
 * administrators the moment a second business was approved, because the code
 * that checks shop authority and the code that would check platform authority
 * would have been reading the same rows. The blast radius of that mistake is
 * every merchant on the platform, and it would have looked like it was working
 * the entire time.
 *
 * So: platform authority lives here, in its own table, with its own enum and
 * no store column, because a platform action belongs to no shop. The two
 * systems never share a row. A person can hold both, and that is fine - it is
 * two grants, made separately, revocable separately.
 *
 * The same reasoning already produced `business_member_role` in marketplace.ts
 * for authority inside one business. Three scopes, three tables, on purpose.
 */

export const platformRoleEnum = pgEnum('platform_role', [
  /**
   * The owner of Musuwo. Exactly one, enforced by a partial unique index in
   * the migration rather than by anyone remembering.
   *
   * Called PLATFORM_OWNER internally and shown as "Platform Owner" in the
   * interface. Not "root", not "super super admin" - the brief is right that
   * the production label should read like a job rather than a permission bit.
   */
  'PLATFORM_OWNER',
  /**
   * Helps run the platform. Powerful, but strictly below the owner: cannot
   * create another admin, cannot grant themselves anything, cannot touch the
   * owner. Capped at ten active, and the cap lives in `platform_settings`.
   */
  'SUPER_ADMIN',
])

/**
 * Whether a grant is currently usable.
 *
 * Deactivating sets this to DEACTIVATED. It never deletes the row, because
 * the audit log points at it and "who approved this business in October" must
 * still resolve to a name a year later.
 */
export const platformAdminStatusEnum = pgEnum('platform_admin_status', [
  'INVITED',
  'ACTIVE',
  'SUSPENDED',
  'DEACTIVATED',
])

export const platformRoles = pgTable(
  'platform_roles',
  {
    id: id(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: platformRoleEnum('role').notNull(),
    status: platformAdminStatusEnum('status').notNull().default('INVITED'),

    /**
     * Who granted this, and when. Null `grantedBy` means the founding migration
     * did it - there was nobody to grant it yet, and pretending otherwise
     * would put a false name in the record.
     */
    grantedBy: uuid('granted_by').references(() => users.id),
    grantedAt: timestamp('granted_at', { withTimezone: true })
      .notNull()
      .defaultNow(),

    /** Set when status leaves ACTIVE. Kept alongside the audit event. */
    revokedBy: uuid('revoked_by').references(() => users.id),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokeReason: text('revoke_reason'),

    lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
    ...timestamps(),
  },
  (t) => [
    unique('platform_roles_user_role_unique').on(t.userId, t.role),
    index('platform_roles_status_idx').on(t.status),
  ],
)

/**
 * What a Super Admin may actually do.
 *
 * Holding SUPER_ADMIN gets you through the door and nothing else. Every
 * sensitive action checks for a specific permission row, so a new admin starts
 * able to look at the Control Center and unable to change anything in it.
 *
 * PLATFORM_OWNER is deliberately NOT given rows here. The owner is allowed
 * everything by virtue of being the owner, checked in one place. Materialising
 * eighteen rows for them would mean somebody could later revoke one and lock
 * the owner out of their own platform.
 *
 * Stored as text rather than an enum: the list will grow as features land, and
 * a permission nobody has yet should not require a migration to name. The
 * canonical list lives in lib/platform/permissions.ts and is validated on
 * write - an unknown string is refused there rather than silently granted.
 */
export const platformPermissions = pgTable(
  'platform_permissions',
  {
    id: id(),
    platformRoleId: uuid('platform_role_id')
      .notNull()
      .references(() => platformRoles.id, { onDelete: 'cascade' }),
    permission: text('permission').notNull(),
    grantedBy: uuid('granted_by').references(() => users.id),
    ...timestamps(),
  },
  (t) => [
    unique('platform_permissions_unique').on(t.platformRoleId, t.permission),
    index('platform_permissions_role_idx').on(t.platformRoleId),
  ],
)

/**
 * Platform-wide configuration, one row per key.
 *
 * Exists so the ten-admin cap is a value somebody can change rather than a
 * number compiled into four files. The shop's own four-admin cap is a database
 * trigger and stays that way - it is a different limit on a different thing,
 * and the two must never be confused for one another.
 */
export const platformSettings = pgTable('platform_settings', {
  key: text('key').primaryKey(),
  /**
   * Written out rather than using the shared `metadata()` helper, which
   * hard-codes the column name `metadata`. Reusing it here produced a Drizzle
   * column called `value` that queried a column called `metadata`, and the
   * only symptom was `column "metadata" does not exist` at runtime. jsonb, not
   * text - see the long note on that helper for what text does to an object.
   */
  value: jsonb('value').$type<unknown>().notNull(),
  description: text('description'),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})

/**
 * Platform-level audit.
 *
 * A sibling of `audit_log` rather than a reuse of it, for one reason: that
 * table's `store_id` is central to how it is read and written, and approving a
 * business, promoting an admin or changing ranking configuration happens
 * inside no shop. Writing those with a null or invented store would corrupt
 * the meaning of every existing row.
 *
 * Append only. Nothing in the application updates or deletes from this table,
 * and the migration revokes UPDATE and DELETE from the application role so
 * that stays true even if somebody writes the code by mistake.
 */
export const platformAuditLog = pgTable(
  'platform_audit_log',
  {
    id: id(),
    actorId: uuid('actor_id').references(() => users.id),
    /** PLATFORM_OWNER or SUPER_ADMIN, recorded as it was at the time. */
    actorRole: text('actor_role'),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    /**
     * Before/after for what changed. Never the whole row.
     *
     * Named explicitly for the same reason as `platform_settings.value`: the
     * shared helper would map this to a column called `metadata`, which is not
     * what the migration created.
     */
    changes: jsonb('changes').$type<Record<string, unknown> | null>(),
    /** Why, where an action requires a reason - ranking changes, suspensions. */
    reason: text('reason'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index('platform_audit_entity_idx').on(t.entityType, t.entityId),
    index('platform_audit_actor_idx').on(t.actorId, t.createdAt),
  ],
)

export const platformRolesRelations = relations(
  platformRoles,
  ({ one, many }) => ({
    user: one(users, {
      fields: [platformRoles.userId],
      references: [users.id],
    }),
    permissions: many(platformPermissions),
  }),
)

export const platformPermissionsRelations = relations(
  platformPermissions,
  ({ one }) => ({
    platformRole: one(platformRoles, {
      fields: [platformPermissions.platformRoleId],
      references: [platformRoles.id],
    }),
  }),
)
