import { and, eq } from 'drizzle-orm'

import { db } from '@/db/client'
import {
  businessApplicationDocuments,
  businessApplications,
} from '@/db/schema/marketplace'
import { platformAuditLog } from '@/db/schema/platform'
import { supabaseAdmin } from '@/lib/supabase/server'
import { assertPermission, type PlatformAdmin } from '@/lib/platform/auth'

/**
 * Verification documents: somebody's national ID, and a photo of them holding
 * it.
 *
 * THIS IS THE MOST SENSITIVE DATA IN THE SYSTEM and it is worth being blunt
 * about why. A national ID number, a photograph of the card, and a photograph
 * of the person's face holding it, together, are everything somebody needs to
 * impersonate them at a bank. Losing this is not "a data breach"; it is
 * handing over identities belonging to people who trusted a marketplace with
 * them so they could sell tomatoes.
 *
 * So:
 *
 *   THE BUCKET IS PRIVATE. Not "unlisted", not "hard to guess" - private, so
 *   an anon key cannot read it at all. The table stores a PATH, never a URL.
 *   If a `https://` ever appears in `path`, somebody has made it public and
 *   that is an incident.
 *
 *   READING ONE NEEDS `sensitive_documents.view`, which is granted separately
 *   from every other reviewing permission and sits alone in its own group in
 *   the permission editor.
 *
 *   EVERY VIEW IS LOGGED, with the viewer, the document and the application,
 *   before the file is fetched. Not after: a log written after a successful
 *   read misses the reads that error out halfway, which are exactly the ones
 *   worth having.
 *
 *   LINKS EXPIRE IN 60 SECONDS. Long enough to open, too short to forward.
 */

const BUCKET = 'business-verification'

/** What may be uploaded, and nothing else. */
export const DOCUMENT_KINDS = {
  ID_DOCUMENT: 'Photo of the ID',
  ID_SELFIE: 'Photo of you holding the ID',
  PROOF_OF_ADDRESS: 'Something showing your address',
  BUSINESS_REGISTRATION: 'Certificate of registration',
  PREMISES_PHOTO: 'Photo of where you trade',
  PROPERTY_PHOTO: 'Photo of the property',
  /**
   * The business's own logo. OPTIONAL for every provider type, deliberately:
   * a woman selling bread from her kitchen does not have a logo, and making
   * one a condition of trading would exclude exactly the people Musuwo is for.
   *
   * It is also the only kind here that is meant to be SEEN by customers, which
   * is why it does not live in the private bucket with the identity documents.
   * See uploadLogo below.
   */
  LOGO: 'Your logo',
} as const

export type DocumentKind = keyof typeof DOCUMENT_KINDS

/**
 * Which kinds a customer-facing surface may EVER see. None of them.
 *
 * Written as an explicit empty set rather than left implicit, so that anybody
 * adding a "show the premises photo on the storefront" feature has to change
 * this line and think about it. Premises photos feel harmless and are the
 * thin end: the same upload path carries ID selfies.
 */
export const PUBLICLY_VIEWABLE_KINDS: ReadonlySet<string> = new Set()

export class DocumentError extends Error {
  constructor(
    public code: 'TOO_BIG' | 'BAD_TYPE' | 'NOT_FOUND' | 'NOT_YOURS' | 'NO_STORAGE',
    message: string,
  ) {
    super(message)
    this.name = 'DocumentError'
  }
}

/** 8MB. A phone photo is 2-4MB; beyond this is a scan nobody needs. */
const MAX_BYTES = 8 * 1024 * 1024

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
])

/**
 * Make sure the private bucket exists.
 *
 * `public: false` is the entire security posture of this module. Created here
 * rather than in a migration because buckets are a Storage concern and SQL
 * cannot express the privacy flag.
 */
async function ensureBucket() {
  const supabase = supabaseAdmin()
  if (!supabase) {
    throw new DocumentError(
      'NO_STORAGE',
      'Document storage is not configured on this deployment.',
    )
  }

  const { data } = await supabase.storage.listBuckets()
  if (data?.some((b) => b.name === BUCKET)) return supabase

  const { error } = await supabase.storage.createBucket(BUCKET, {
    public: false,
    fileSizeLimit: MAX_BYTES,
  })
  // A concurrent request may have created it between the check and here.
  if (error && !/already exists/i.test(error.message)) {
    throw new DocumentError('NO_STORAGE', error.message)
  }
  return supabase
}

/**
 * Store a document against an application.
 *
 * The path deliberately contains no name and no ID number - only the
 * application id, the kind and a random suffix. A path that reads
 * `national-id-63-123456A.jpg` leaks in log lines, error messages and
 * screenshots long before anybody opens the file.
 */
export async function uploadDocument(params: {
  userId: string
  applicationId: string
  kind: DocumentKind
  file: File
}): Promise<void> {
  if (!(params.kind in DOCUMENT_KINDS)) {
    throw new DocumentError('BAD_TYPE', 'That is not a document we ask for.')
  }
  if (params.file.size > MAX_BYTES) {
    throw new DocumentError(
      'TOO_BIG',
      'That file is larger than 8MB. A normal phone photo is fine.',
    )
  }
  if (!ALLOWED_MIME.has(params.file.type)) {
    throw new DocumentError(
      'BAD_TYPE',
      'Send a photo or a PDF. Other kinds of file are not accepted.',
    )
  }

  const [app] = await db
    .select({
      id: businessApplications.id,
      applicantId: businessApplications.applicantId,
      status: businessApplications.status,
    })
    .from(businessApplications)
    .where(eq(businessApplications.id, params.applicationId))

  // Same message either way. Confirming somebody else's application exists is
  // information they should not have.
  if (!app || app.applicantId !== params.userId) {
    throw new DocumentError('NOT_FOUND', 'No such application.')
  }
  if (app.status === 'APPROVED' || app.status === 'REJECTED') {
    throw new DocumentError(
      'NOT_YOURS',
      'This application has been decided and no longer accepts uploads.',
    )
  }

  const supabase = await ensureBucket()

  const ext =
    params.file.type === 'application/pdf'
      ? 'pdf'
      : (params.file.name.split('.').pop()?.toLowerCase().slice(0, 5) ?? 'jpg')
  const path = `${params.applicationId}/${params.kind}-${crypto.randomUUID()}.${ext}`

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, await params.file.arrayBuffer(), {
      contentType: params.file.type,
      upsert: false,
    })

  if (error) throw new DocumentError('NO_STORAGE', error.message)

  /**
   * METADATA FIRST, THEN DELETE THE OLD FILE. The order matters and the
   * previous order was wrong.
   *
   * It used to delete the old storage object and the old row, and only then
   * insert the new row. If that insert failed, the applicant was left with no
   * document at all, their original evidence already gone from the bucket and
   * unrecoverable, and the file they had just uploaded orphaned with nothing
   * pointing at it. Somebody replacing a blurry ID photo could lose the
   * readable one they already had.
   *
   * Now: the row is written in a transaction; if that fails, the file just
   * uploaded is removed so the bucket does not accumulate untracked identity
   * documents; and the PREVIOUS file is deleted only once the new metadata has
   * committed. At every instant there is exactly one row and at least one file.
   *
   * A partial unique index on (application_id, kind) - migration 0017 - makes
   * two simultaneous uploads impossible to resolve into two rows: one of them
   * loses, and the loser cleans up after itself in the catch below.
   */
  const single = !['PREMISES_PHOTO', 'PROPERTY_PHOTO'].includes(params.kind)
  let previousPath: string | null = null

  try {
    previousPath = await db.transaction(async (tx) => {
      if (!single) {
        await tx.insert(businessApplicationDocuments).values({
          applicationId: params.applicationId,
          uploadedBy: params.userId,
          kind: params.kind,
          path,
          mimeType: params.file.type,
          sizeBytes: params.file.size,
          originalName: null,
        })
        return null
      }

      const [old] = await tx
        .select({ path: businessApplicationDocuments.path })
        .from(businessApplicationDocuments)
        .where(
          and(
            eq(businessApplicationDocuments.applicationId, params.applicationId),
            eq(businessApplicationDocuments.kind, params.kind),
          ),
        )
        .for('update')

      if (old) {
        await tx
          .update(businessApplicationDocuments)
          .set({
            path,
            uploadedBy: params.userId,
            mimeType: params.file.type,
            sizeBytes: params.file.size,
            createdAt: new Date(),
          })
          .where(
            and(
              eq(businessApplicationDocuments.applicationId, params.applicationId),
              eq(businessApplicationDocuments.kind, params.kind),
            ),
          )
        return old.path
      }

      // No existing row. A concurrent upload racing us here loses on the
      // unique index and compensates in its own catch.
      await tx.insert(businessApplicationDocuments).values({
        applicationId: params.applicationId,
        uploadedBy: params.userId,
        kind: params.kind,
        path,
        mimeType: params.file.type,
        sizeBytes: params.file.size,
        // The original filename is NOT stored. People name files things like
        // "my id.jpg" and sometimes worse, and it serves no purpose here.
        originalName: null,
      })
      return null
    })
  } catch (dbError) {
    console.error('[documents] metadata write failed:', (dbError as Error).message)
    // The metadata did not commit, so nothing points at the file we just put
    // in the bucket. Remove it rather than leaving an untracked identity
    // document behind.
    const { error: rollbackError } = await supabase.storage
      .from(BUCKET)
      .remove([path])
    if (rollbackError) {
      // Worth shouting about: an unreferenced ID photo is now sitting in the
      // bucket. `npm run storage:orphans` finds these.
      console.error(
        '[documents] ORPHANED FILE - upload succeeded, metadata failed, cleanup failed:',
        path,
        rollbackError.message,
      )
    }
    throw new DocumentError(
      'NO_STORAGE',
      'That did not save. Your previous document is untouched - please try again.',
    )
  }

  /**
   * Only now is the old file removed, and the result is CHECKED.
   *
   * Ignoring it was the other half of the original bug: a failed delete left a
   * national ID in the bucket after its only database reference was gone - a
   * document nobody knows exists and nobody will ever remove. A failure here
   * does not fail the upload, because the new document is safely recorded and
   * refusing at this point would be worse for the applicant. It is logged
   * loudly instead, and `npm run storage:orphans` reports it.
   */
  if (previousPath && previousPath !== path) {
    const { error: removeError } = await supabase.storage
      .from(BUCKET)
      .remove([previousPath])
    if (removeError) {
      console.error(
        '[documents] ORPHANED FILE - replaced but old object not deleted:',
        previousPath,
        removeError.message,
      )
    }
  }
}

/** What has been uploaded. Metadata only - never a URL. */
export async function listDocuments(applicationId: string) {
  return db
    .select({
      id: businessApplicationDocuments.id,
      kind: businessApplicationDocuments.kind,
      mimeType: businessApplicationDocuments.mimeType,
      sizeBytes: businessApplicationDocuments.sizeBytes,
      createdAt: businessApplicationDocuments.createdAt,
    })
    .from(businessApplicationDocuments)
    .where(eq(businessApplicationDocuments.applicationId, applicationId))
}

/**
 * Open one, as a reviewer.
 *
 * The audit row is written BEFORE the link is minted. A log written after a
 * successful fetch misses every read that errored halfway, and those are
 * exactly the ones worth having.
 */
export async function openDocument(documentId: string): Promise<string> {
  const admin: PlatformAdmin = await assertPermission('sensitive_documents.view')

  const [doc] = await db
    .select()
    .from(businessApplicationDocuments)
    .where(eq(businessApplicationDocuments.id, documentId))

  if (!doc) throw new DocumentError('NOT_FOUND', 'No such document.')

  await db.insert(platformAuditLog).values({
    actorId: admin.user.id,
    actorRole: admin.role,
    action: 'VERIFICATION_DOCUMENT_VIEWED',
    entityType: 'business_application_document',
    entityId: doc.id,
    changes: { kind: doc.kind, applicationId: doc.applicationId },
  })

  const supabase = supabaseAdmin()
  if (!supabase) {
    throw new DocumentError('NO_STORAGE', 'Document storage is not configured.')
  }

  // Sixty seconds. Long enough to open, too short to paste into a group chat
  // and still work by the time somebody reads it.
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(doc.path, 60)

  if (error || !data) {
    throw new DocumentError('NOT_FOUND', error?.message ?? 'Could not open it.')
  }

  return data.signedUrl
}
