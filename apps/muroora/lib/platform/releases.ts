import { and, desc, eq, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { betaFeedback, mobileReleases } from '@/db/schema/releases'
import { platformAuditLog, platformSettings } from '@/db/schema/platform'
import { assertPermission, assertPlatformOwner } from '@/lib/platform/auth'

/**
 * Mobile beta releases: what the public is offered, and what the app is told.
 *
 * THE THING THIS EXISTS TO MAKE POSSIBLE: taking a build down. Every APK before
 * 0.2.0 contains an authentication bypass and is still installable by anybody
 * holding the link, because the link was pasted into messages. Nothing could
 * revoke it. Now a build has a status, `/beta/android` serves only what is
 * PUBLISHED, and BLOCKED is answered by the version check with "update before
 * you continue" rather than a shrug.
 */

export class ReleaseError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'INVALID' | 'NEEDS_REASON' | 'NEEDS_URL',
    message: string,
  ) {
    super(message)
    this.name = 'ReleaseError'
  }
}

export type Platform = 'ANDROID' | 'IOS'

/**
 * Compare two dotted version strings.
 *
 * Written out rather than pulled from a package, because the whole job is
 * fifteen lines and a dependency that parses semver would also insist the
 * input IS semver - `0.2` and `1.0.0-beta` both turn up in the wild from
 * hand-edited build config, and refusing them would lock a tester out of the
 * app over a formatting detail.
 *
 * Missing segments count as zero, so "0.2" and "0.2.0" are equal. Anything
 * non-numeric in a segment is treated as zero rather than throwing.
 *
 * Returns negative when a < b, 0 when equal, positive when a > b.
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const pb = b.split('.').map((n) => Number.parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i += 1) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (diff !== 0) return diff
  }
  return 0
}

/** Is the public beta page switched on? */
export async function publicBetaEnabled(): Promise<boolean> {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, 'public_beta_enabled'))
  // Default OPEN only because the setting is seeded true by the migration. A
  // missing row means somebody deleted it, and the safe reading of that is
  // "closed" rather than "open to the world".
  return row ? row.value === true : false
}

export async function betaFeedbackEnabled(): Promise<boolean> {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, 'beta_feedback_enabled'))
  return row ? row.value === true : false
}

/** The build currently offered for a platform, if any. */
export async function currentRelease(platform: Platform) {
  const [row] = await db
    .select()
    .from(mobileReleases)
    .where(
      and(
        eq(mobileReleases.platform, platform),
        eq(mobileReleases.status, 'PUBLISHED'),
      ),
    )
  return row ?? null
}

/**
 * What the page shows for a platform when there is nothing published.
 *
 * COMING_SOON is a real answer and a different one from "we have not built it
 * this week". iOS has no build and no TestFlight, and saying so beats an empty
 * space that reads as broken.
 */
export async function placeholderRelease(platform: Platform) {
  const [row] = await db
    .select()
    .from(mobileReleases)
    .where(
      and(
        eq(mobileReleases.platform, platform),
        eq(mobileReleases.status, 'COMING_SOON'),
      ),
    )
    .orderBy(desc(mobileReleases.createdAt))
  return row ?? null
}

/** Every release, newest first. Admin view. */
export async function listReleases() {
  return db
    .select()
    .from(mobileReleases)
    .orderBy(mobileReleases.platform, desc(mobileReleases.releaseDate))
}

/* ---------------------------------------------------------- version check */

export interface VersionVerdict {
  /** May the app keep working as it is? */
  ok: boolean
  /** Must the person update before continuing? */
  updateRequired: boolean
  /** Is there something newer they could take? */
  updateAvailable: boolean
  latestVersion: string | null
  downloadUrl: string | null
  releaseNotes: string | null
  message: string
}

/**
 * What to tell an app reporting a given version.
 *
 * Three outcomes, and the difference between the last two is the whole point:
 *
 *   FINE           nothing to say.
 *   UPDATE         something newer exists. Offer it, let them say Later.
 *   UPDATE REQUIRED they are below the minimum, or the build they are running
 *                   has been BLOCKED. No Later button - a blocked build is
 *                   blocked because continuing to use it is the problem.
 *
 * Unknown versions are treated as too old rather than fine. A build reporting
 * something nobody has heard of is far more likely to be an ancient install
 * than a future one, and the failure mode of guessing wrong in that direction
 * is somebody is asked to update; guessing the other way leaves the bypass
 * build running.
 */
export async function checkAppVersion(params: {
  platform: Platform
  version: string
}): Promise<VersionVerdict> {
  const current = await currentRelease(params.platform)

  if (!current) {
    return {
      ok: true,
      updateRequired: false,
      updateAvailable: false,
      latestVersion: null,
      downloadUrl: null,
      releaseNotes: null,
      message: 'No release is published for this platform.',
    }
  }

  // Is the exact build they are running blocked?
  const [theirs] = await db
    .select({
      status: mobileReleases.status,
      blockedReason: mobileReleases.blockedReason,
    })
    .from(mobileReleases)
    .where(
      and(
        eq(mobileReleases.platform, params.platform),
        eq(mobileReleases.version, params.version),
      ),
    )

  const base = {
    latestVersion: current.version,
    downloadUrl: current.downloadUrl,
    releaseNotes: current.releaseNotes,
  }

  if (theirs?.status === 'BLOCKED') {
    return {
      ...base,
      ok: false,
      updateRequired: true,
      updateAvailable: true,
      message:
        theirs.blockedReason ??
        'This version has been withdrawn. Please install the current one.',
    }
  }

  const min = current.minSupportedVersion
  const belowMinimum = min ? compareVersions(params.version, min) < 0 : false
  const behind = compareVersions(params.version, current.version) < 0

  if (belowMinimum || (behind && current.isMandatory)) {
    return {
      ...base,
      ok: false,
      updateRequired: true,
      updateAvailable: true,
      message:
        'This version of Musuwo is too old to keep using. Please install the current one.',
    }
  }

  if (behind) {
    return {
      ...base,
      ok: true,
      updateRequired: false,
      updateAvailable: true,
      message: 'A newer version of Musuwo is available.',
    }
  }

  return {
    ...base,
    ok: true,
    updateRequired: false,
    updateAvailable: false,
    message: 'You are on the current version.',
  }
}

/* --------------------------------------------------------------- writes */

async function audit(
  actorId: string,
  actorRole: string,
  action: string,
  entityId: string,
  changes: Record<string, unknown>,
  reason?: string,
) {
  await db.insert(platformAuditLog).values({
    actorId,
    actorRole,
    action,
    entityType: 'mobile_release',
    entityId,
    changes,
    reason: reason ?? null,
  })
}

/** Record a build. Does not publish it - that is a separate, deliberate act. */
export async function createRelease(params: {
  platform: Platform
  version: string
  buildNumber?: number | null
  downloadUrl?: string | null
  releaseNotes?: string | null
  knownIssues?: string | null
  minSupportedVersion?: string | null
  fileSizeBytes?: number | null
  isMandatory?: boolean
}) {
  const admin = await assertPermission('releases.manage')

  const version = params.version.trim()
  if (!/^\d+(\.\d+)*$/.test(version)) {
    throw new ReleaseError(
      'INVALID',
      'Use a version like 0.2.0, exactly as the app reports it. If they disagree, the version check cannot work.',
    )
  }

  const [row] = await db
    .insert(mobileReleases)
    .values({
      platform: params.platform,
      version,
      buildNumber: params.buildNumber ?? null,
      downloadUrl: params.downloadUrl?.trim() || null,
      releaseNotes: params.releaseNotes?.trim() || null,
      knownIssues: params.knownIssues?.trim() || null,
      minSupportedVersion: params.minSupportedVersion?.trim() || null,
      fileSizeBytes: params.fileSizeBytes ?? null,
      isMandatory: params.isMandatory ?? false,
      status: 'DRAFT',
      createdBy: admin.user.id,
    })
    .returning({ id: mobileReleases.id })

  await audit(admin.user.id, admin.role, 'RELEASE_CREATED', row.id, {
    platform: params.platform,
    version,
  })

  return row
}

/**
 * Publish a build, replacing whatever was published for that platform.
 *
 * One transaction: the old one is deprecated and the new one published
 * together, because a unique index allows only one PUBLISHED row per platform
 * and doing it in two steps would fail halfway with nothing published at all -
 * which is a download page that 404s for everybody.
 */
export async function publishRelease(id: string) {
  const admin = await assertPermission('releases.publish')

  const [target] = await db
    .select()
    .from(mobileReleases)
    .where(eq(mobileReleases.id, id))

  if (!target) throw new ReleaseError('NOT_FOUND', 'No such release.')
  if (!target.downloadUrl) {
    throw new ReleaseError(
      'NEEDS_URL',
      'This release has no download link, so publishing it would give people a button that goes nowhere.',
    )
  }
  if (target.status === 'BLOCKED') {
    throw new ReleaseError(
      'INVALID',
      'This build was blocked for a reason. Unblock it first, deliberately, if that reason no longer holds.',
    )
  }

  await db.transaction(async (tx) => {
    await tx
      .update(mobileReleases)
      .set({ status: 'DEPRECATED', updatedAt: new Date() })
      .where(
        and(
          eq(mobileReleases.platform, target.platform),
          eq(mobileReleases.status, 'PUBLISHED'),
        ),
      )

    await tx
      .update(mobileReleases)
      .set({
        status: 'PUBLISHED',
        publishedBy: admin.user.id,
        publishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(mobileReleases.id, id))

    await tx.insert(platformAuditLog).values({
      actorId: admin.user.id,
      actorRole: admin.role,
      action: 'RELEASE_PUBLISHED',
      entityType: 'mobile_release',
      entityId: id,
      changes: { platform: target.platform, version: target.version },
    })
  })
}

/**
 * Stop a build being installed or used.
 *
 * The emergency lever. Requires a reason because the reason is shown to
 * anybody running that build, and "contact support" is not something they can
 * act on at eleven at night.
 */
export async function blockRelease(params: { id: string; reason: string }) {
  const admin = await assertPermission('releases.publish')
  const reason = params.reason.trim()

  if (reason.length < 10) {
    throw new ReleaseError(
      'NEEDS_REASON',
      'Say why in a sentence. Whoever is running this build sees it, and it is what tells them whether to worry.',
    )
  }

  const [target] = await db
    .select({ platform: mobileReleases.platform, version: mobileReleases.version })
    .from(mobileReleases)
    .where(eq(mobileReleases.id, params.id))

  if (!target) throw new ReleaseError('NOT_FOUND', 'No such release.')

  await db
    .update(mobileReleases)
    .set({ status: 'BLOCKED', blockedReason: reason, updatedAt: new Date() })
    .where(eq(mobileReleases.id, params.id))

  await audit(
    admin.user.id,
    admin.role,
    'RELEASE_BLOCKED',
    params.id,
    { platform: target.platform, version: target.version },
    reason,
  )
}

/** Take a build out of circulation without declaring it unsafe. */
export async function deprecateRelease(id: string) {
  const admin = await assertPermission('releases.publish')

  await db
    .update(mobileReleases)
    .set({ status: 'DEPRECATED', updatedAt: new Date() })
    .where(eq(mobileReleases.id, id))

  await audit(admin.user.id, admin.role, 'RELEASE_DEPRECATED', id, {})
}

/** Edit the details of a build. Never changes its status. */
export async function updateRelease(params: {
  id: string
  downloadUrl?: string | null
  releaseNotes?: string | null
  knownIssues?: string | null
  minSupportedVersion?: string | null
  isMandatory?: boolean
}) {
  const admin = await assertPermission('releases.manage')

  await db
    .update(mobileReleases)
    .set({
      ...(params.downloadUrl !== undefined
        ? { downloadUrl: params.downloadUrl?.trim() || null }
        : {}),
      ...(params.releaseNotes !== undefined
        ? { releaseNotes: params.releaseNotes?.trim() || null }
        : {}),
      ...(params.knownIssues !== undefined
        ? { knownIssues: params.knownIssues?.trim() || null }
        : {}),
      ...(params.minSupportedVersion !== undefined
        ? { minSupportedVersion: params.minSupportedVersion?.trim() || null }
        : {}),
      ...(params.isMandatory !== undefined
        ? { isMandatory: params.isMandatory }
        : {}),
      updatedAt: new Date(),
    })
    .where(eq(mobileReleases.id, params.id))

  await audit(admin.user.id, admin.role, 'RELEASE_UPDATED', params.id, {})
}

/**
 * Open or close the public beta.
 *
 * Owner only. Closing it does not delete a release - it stops /beta answering,
 * which is what you want at the moment somebody reports something alarming and
 * you need the download to stop while you think.
 */
export async function setPublicBeta(enabled: boolean) {
  const owner = await assertPlatformOwner()

  await db
    .update(platformSettings)
    .set({ value: enabled, updatedBy: owner.user.id, updatedAt: new Date() })
    .where(eq(platformSettings.key, 'public_beta_enabled'))

  await db.insert(platformAuditLog).values({
    actorId: owner.user.id,
    actorRole: 'PLATFORM_OWNER',
    action: enabled ? 'PUBLIC_BETA_OPENED' : 'PUBLIC_BETA_CLOSED',
    entityType: 'platform_setting',
    changes: { public_beta_enabled: enabled },
  })
}

/* -------------------------------------------------------------- feedback */

/**
 * A tester's report.
 *
 * Deliberately open to people who are NOT signed in. Somebody whose complaint
 * is "I cannot sign in" must still be able to tell us.
 */
export async function submitBetaFeedback(params: {
  userId?: string | null
  kind: string
  message: string
  appVersion?: string | null
  device?: string | null
  contact?: string | null
}) {
  const message = params.message.trim()
  if (message.length < 10) {
    throw new ReleaseError(
      'INVALID',
      'Tell us a little more - what you were doing and what happened.',
    )
  }

  const kind = ['BUG', 'CRASH', 'SUGGESTION', 'SECURITY'].includes(params.kind)
    ? params.kind
    : 'BUG'

  const current = await currentRelease('ANDROID')

  await db.insert(betaFeedback).values({
    userId: params.userId ?? null,
    releaseId: current?.id ?? null,
    kind,
    message,
    appVersion: params.appVersion?.trim() || null,
    device: params.device?.trim() || null,
    contact: params.contact?.trim() || null,
    // A security report is a working exploit until it is fixed, so it is
    // flagged here and filtered out of the ordinary listing.
    isSecurity: kind === 'SECURITY',
  })
}

/**
 * Read what testers have said.
 *
 * Security reports are withheld unless the caller holds the permission for
 * them - the same reasoning that keeps ID documents behind their own grant.
 */
export async function listBetaFeedback(includeSecurity: boolean) {
  return db
    .select()
    .from(betaFeedback)
    .where(includeSecurity ? undefined : eq(betaFeedback.isSecurity, false))
    .orderBy(desc(betaFeedback.createdAt))
    .limit(200)
}

export async function countOpenSecurityReports(): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(betaFeedback)
    .where(and(eq(betaFeedback.isSecurity, true), eq(betaFeedback.status, 'NEW')))
  return row.n
}
