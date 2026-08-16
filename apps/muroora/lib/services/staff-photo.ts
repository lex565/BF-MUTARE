import { createClient } from '@supabase/supabase-js'
import { and, eq } from 'drizzle-orm'

import { db } from '@/db/client'
import { auditLog, staffProfiles } from '@/db/schema'
import { StaffError } from '@/lib/services/staff'

/**
 * Staff photographs.
 *
 * The owner's requirement: "for staff they cant finish creating the account
 * without the picture". A staff photo is not decoration here — it is how a
 * customer at the door knows the person holding their shopping works for the
 * shop.
 *
 * A PHOTOGRAPH OF AN EMPLOYEE IS PERSONAL DATA, so:
 *
 *   - the bucket is PRIVATE. Nothing is served from a public URL.
 *   - the database stores a storage PATH, never a URL.
 *   - viewing one mints a short-lived signed URL, server-side.
 *   - every read is written to the audit log, because "who looked at that
 *     employee's photograph, and when" has to be answerable. Same discipline
 *     the rider ID documents will need in Phase 3 (D-005).
 *
 * The service-role key is used here and is SERVER ONLY. It must never gain a
 * NEXT_PUBLIC_ prefix; this module imports nothing from `next/*` and is only
 * ever called from server actions and route handlers.
 */

const BUCKET = 'staff-photos'

/** Signed URLs are short-lived on purpose: a leaked link expires by itself. */
const SIGNED_URL_SECONDS = 60 * 5

const MAX_BYTES = 5 * 1024 * 1024

/**
 * Accepted types, checked against the file's actual bytes rather than its
 * name or its declared MIME type. A browser will happily report
 * `image/jpeg` for anything, and the extension is whatever the uploader
 * typed.
 */
const MAGIC: ReadonlyArray<{ ext: string; bytes: number[]; offset?: number }> = [
  { ext: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { ext: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { ext: 'webp', bytes: [0x57, 0x45, 0x42, 0x50], offset: 8 },
]

function sniff(buffer: Uint8Array): string | null {
  for (const type of MAGIC) {
    const at = type.offset ?? 0
    if (buffer.length < at + type.bytes.length) continue
    if (type.bytes.every((b, i) => buffer[at + i] === b)) return type.ext
  }
  return null
}

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new StaffError(
      'NO_PHOTO',
      'Photo storage is not configured on this server.',
    )
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** Create the private bucket if it is not there. Safe to call repeatedly. */
export async function ensurePhotoBucket(): Promise<void> {
  const supabase = admin()
  const { data } = await supabase.storage.listBuckets()
  if (data?.some((b) => b.name === BUCKET)) return

  await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  })
}

/**
 * Store a staff photograph and record the path on the profile.
 *
 * Returns the storage path. The caller never sees a URL, and no URL is
 * persisted anywhere.
 */
export async function uploadStaffPhoto(params: {
  userId: string
  file: File
  actorId: string
}): Promise<{ path: string }> {
  const [profile] = await db
    .select()
    .from(staffProfiles)
    .where(eq(staffProfiles.userId, params.userId))

  if (!profile) {
    throw new StaffError('NOT_FOUND', 'No staff record for that account.')
  }

  if (params.file.size === 0) {
    throw new StaffError('NO_PHOTO', 'That file is empty.')
  }
  if (params.file.size > MAX_BYTES) {
    throw new StaffError(
      'NO_PHOTO',
      `That photo is ${(params.file.size / 1024 / 1024).toFixed(1)}MB. ` +
        `The limit is 5MB — most phones can send a smaller copy.`,
    )
  }

  const bytes = new Uint8Array(await params.file.arrayBuffer())
  const ext = sniff(bytes)
  if (!ext) {
    throw new StaffError(
      'NO_PHOTO',
      'That does not look like a photo. Use a JPG, PNG or WEBP taken on a ' +
        'phone or camera.',
    )
  }

  await ensurePhotoBucket()
  const supabase = admin()

  // Path includes the staff number so a file found loose in storage can still
  // be traced to a person, and a timestamp so re-uploads do not collide with
  // a cached copy of the old one.
  const path = `${profile.staffNumber}/${Date.now()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, bytes, {
      contentType:
        ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : 'image/webp',
      upsert: false,
    })

  if (error) {
    throw new StaffError('NO_PHOTO', `Could not save that photo: ${error.message}`)
  }

  const previous = profile.photoPath

  await db
    .update(staffProfiles)
    .set({ photoPath: path, updatedAt: new Date() })
    .where(eq(staffProfiles.id, profile.id))

  // The old file is removed after the new path is committed, not before. If
  // the update failed we would otherwise have deleted the only copy.
  if (previous && previous !== path) {
    await supabase.storage.from(BUCKET).remove([previous])
  }

  await db.insert(auditLog).values({
    storeId: STORE_ID,
    actorId: params.actorId,
    actorRole: params.actorId === params.userId ? 'STAFF' : 'ADMIN',
    action: 'STAFF_PHOTO_SET',
    entityType: 'staff_profile',
    entityId: profile.id,
    changes: { staffNumber: profile.staffNumber, replaced: Boolean(previous) },
  })

  return { path }
}

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!

/**
 * A short-lived URL for one photograph.
 *
 * Every call is logged. That is the point: a private bucket only means
 * something if opening it leaves a trace.
 */
export async function signedPhotoUrl(params: {
  path: string | null
  viewerId: string
}): Promise<string | null> {
  if (!params.path) return null

  const supabase = admin()
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(params.path, SIGNED_URL_SECONDS)

  if (error || !data) return null

  await db.insert(auditLog).values({
    storeId: STORE_ID,
    actorId: params.viewerId,
    actorRole: 'STAFF',
    action: 'STAFF_PHOTO_VIEWED',
    entityType: 'staff_profile',
    entityId: null,
    changes: { path: params.path },
  })

  return data.signedUrl
}

/**
 * Has this person finished setting up?
 *
 * "Staff cannot finish creating the account without the picture" — so this is
 * the check that decides whether the staff tools open. Their login works
 * either way; what is gated is the work.
 */
export async function staffSetupComplete(userId: string): Promise<{
  complete: boolean
  missing: string[]
}> {
  const [profile] = await db
    .select()
    .from(staffProfiles)
    .where(
      and(
        eq(staffProfiles.userId, userId),
        eq(staffProfiles.storeId, STORE_ID),
      ),
    )

  const missing: string[] = []
  if (!profile) missing.push('a staff record — an admin has to add you')
  else if (!profile.photoPath) missing.push('your photograph')

  return { complete: missing.length === 0, missing }
}
