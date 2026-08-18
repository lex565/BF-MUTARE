import {
  bigint,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core'

import { id } from './_shared'
import { users } from './identity'

/**
 * Mobile beta distribution.
 *
 * The download link used to be a 90-character Expo artifact URL living in a
 * note and a WhatsApp message. Every build produced a new one, so "where do I
 * get the app" had a different answer each week - and when a build turned out
 * to contain an authentication bypass there was no way to take it down.
 *
 * Releases live here so the owner can publish, deprecate or BLOCK a build from
 * a browser, and so nothing in the interface hard-codes a URL. See migration
 * 0015 for the longer reasoning.
 */

export const releasePlatformEnum = pgEnum('release_platform', ['ANDROID', 'IOS'])

export const releaseStatusEnum = pgEnum('release_status', [
  'DRAFT',
  'PUBLISHED',
  'DEPRECATED',
  /** Stop installing this. Refused by the redirect and by the version check. */
  'BLOCKED',
  /** iOS, until TestFlight actually exists. No URL is invented. */
  'COMING_SOON',
])

export const mobileReleases = pgTable(
  'mobile_releases',
  {
    id: id(),
    platform: releasePlatformEnum('platform').notNull(),
    version: text('version').notNull(),
    /** Android versionCode. Monotonic, unlike a version string. */
    buildNumber: integer('build_number'),
    releaseDate: timestamp('release_date', { withTimezone: true })
      .notNull()
      .defaultNow(),
    /** Null is legitimate on a COMING_SOON row - there is nowhere to point. */
    downloadUrl: text('download_url'),
    releaseNotes: text('release_notes'),
    knownIssues: text('known_issues'),
    /** Anything below this is refused, whatever its status. */
    minSupportedVersion: text('min_supported_version'),
    status: releaseStatusEnum('status').notNull().default('DRAFT'),
    isMandatory: boolean('is_mandatory').notNull().default(false),
    fileSizeBytes: bigint('file_size_bytes', { mode: 'number' }),
    publishedBy: uuid('published_by').references(() => users.id),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    blockedReason: text('blocked_reason'),
    createdBy: uuid('created_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique('mobile_releases_platform_version_unique').on(t.platform, t.version),
    index('mobile_releases_platform_status_idx').on(t.platform, t.status),
  ],
)

/**
 * What testers tell us.
 *
 * `isSecurity` matters: a report saying "the account screen lets anybody in"
 * is a working exploit until it is fixed, so it never appears on a shared list.
 */
export const betaFeedback = pgTable(
  'beta_feedback',
  {
    id: id(),
    /** Null when not signed in - a tester who cannot log IN is worth hearing. */
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    releaseId: uuid('release_id').references(() => mobileReleases.id),
    /** BUG, CRASH, SUGGESTION, SECURITY */
    kind: text('kind').notNull(),
    message: text('message').notNull(),
    appVersion: text('app_version'),
    device: text('device'),
    contact: text('contact'),
    isSecurity: boolean('is_security').notNull().default(false),
    status: text('status').notNull().default('NEW'),
    handledBy: uuid('handled_by').references(() => users.id),
    handledAt: timestamp('handled_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index('beta_feedback_status_idx').on(t.status, t.createdAt)],
)
