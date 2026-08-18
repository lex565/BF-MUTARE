import { and, asc, eq, inArray } from 'drizzle-orm'

import { db } from '@/db/client'
import type { ProviderType, Readiness, Requirement } from '@/lib/platform/provider-types'
import {
  addressEvidenceTypes,
  businessApplicationDocuments,
  businessApplicationEvents,
  businessApplications,
  providerRequirements,
} from '@/db/schema/marketplace'

/**
 * Starting an application is easy. Submitting one is not.
 *
 * THE SHAPE OF THE PROBLEM. Somebody selling sadza from her kitchen does not
 * have a utility bill in her own name today, and may not for months. If the
 * form is submit-or-nothing she leaves and does not come back. So she can
 * start, see exactly what is needed, fill in what she has, and return.
 *
 * What she cannot do is submit an incomplete application, because a reviewer
 * receiving one has to reject it, and a rejection reads as "no" rather than
 * "not yet" - which is the difference between somebody trying again and
 * somebody giving up.
 *
 * THE GATE IS HERE, ON THE SERVER, AND ONLY HERE. The form disables its own
 * submit button as a courtesy. That button is not a control: a server action is
 * a public endpoint and anybody signed in can call it with any payload. Every
 * submission is re-checked by `readiness()` before the status moves.
 *
 * REQUIREMENTS COME FROM THE DATABASE, not from a constant in this file, so the
 * "you will need" screen and this gate read the SAME rows. Two lists that can
 * disagree is how a form tells somebody they are ready and the server then
 * refuses them, with no explanation either side can give.
 */

/**
 * Provider types, the type list and the readiness shapes live in
 * ./provider-types, which imports nothing. The registration FORM is a client
 * component and needs them; this module imports the database client, and
 * pulling that into the browser bundle breaks the build with "Can't resolve
 * 'fs'". Re-exported so server callers still have one place to import from.
 */
export {
  PROVIDER_TYPES,
  type ProviderType,
  type Requirement,
  type Readiness,
} from '@/lib/platform/provider-types'

/** What this provider type is asked for, in order. */
export async function requirementsFor(providerType: ProviderType) {
  return db
    .select()
    .from(providerRequirements)
    .where(eq(providerRequirements.providerType, providerType))
    .orderBy(asc(providerRequirements.sortOrder))
}

/** The address evidence the Platform Owner currently accepts. */
export async function acceptedAddressEvidence() {
  return db
    .select()
    .from(addressEvidenceTypes)
    .where(eq(addressEvidenceTypes.isEnabled, true))
    .orderBy(asc(addressEvidenceTypes.sortOrder))
}

/**
 * Which document kinds satisfy which requirement.
 *
 * Separate from the requirement key because one requirement can be met by
 * more than one kind of upload - property photos, for instance, are several
 * files of the same kind.
 */
const DOCUMENT_FOR: Record<string, string> = {
  id_document: 'ID_DOCUMENT',
  id_selfie: 'ID_SELFIE',
  address_evidence: 'PROOF_OF_ADDRESS',
  registration_document: 'BUSINESS_REGISTRATION',
  premises_photo: 'PREMISES_PHOTO',
  property_photos: 'PROPERTY_PHOTO',
  logo: 'LOGO',
}

/**
 * Is this application ready to be submitted?
 *
 * Called by the form to draw the checklist AND by the submit action to decide.
 * One function, so what the person is shown and what the server enforces
 * cannot drift apart.
 *
 * An unknown requirement key - one somebody added to the table that this file
 * does not understand - is reported as MET rather than missing. Deliberately:
 * the alternative is that adding a row silently makes submission impossible
 * for everybody, with no error anybody can see. It fails towards letting
 * people in, and a reviewer still sees the application.
 */
export async function readiness(applicationId: string): Promise<Readiness> {
  const [app] = await db
    .select()
    .from(businessApplications)
    .where(eq(businessApplications.id, applicationId))

  if (!app?.providerType) {
    return { providerType: null, requirements: [], missing: [], canSubmit: false }
  }

  const providerType = app.providerType as ProviderType
  const rows = await requirementsFor(providerType)

  const docs = await db
    .select({ kind: businessApplicationDocuments.kind })
    .from(businessApplicationDocuments)
    .where(eq(businessApplicationDocuments.applicationId, applicationId))
  const haveKinds = new Set(docs.map((d) => d.kind))

  const filled = (v: string | null | undefined) => Boolean(v && v.trim())

  const isMet = (key: string): boolean => {
    switch (key) {
      case 'legal_name':
        return filled(app.legalName)
      case 'phone':
        return filled(app.contactPhone) || filled(app.whatsapp)
      case 'address':
        return filled(app.residentialAddress)
      case 'address_evidence':
        // BOTH: which kind of evidence, and the file itself. Recording the
        // type without the document is a claim; the document without the type
        // leaves a reviewer guessing what they are looking at.
        return filled(app.addressEvidenceType) && haveKinds.has('PROOF_OF_ADDRESS')
      case 'operating_area':
        return filled(app.operatingArea)
      case 'business_name':
        return filled(app.businessName)
      case 'category':
        return Boolean(app.kind)
      case 'summary':
        return filled(app.summary)
      case 'registration_number':
        return filled(app.registrationNumber)
      default: {
        const docKind = DOCUMENT_FOR[key]
        // Unknown key: treat as met. See the note above.
        if (!docKind) return true
        return haveKinds.has(docKind)
      }
    }
  }

  const requirements: Requirement[] = rows.map((r) => ({
    requirement: r.requirement,
    label: r.label,
    note: r.note,
    isMandatory: r.isMandatory,
    met: isMet(r.requirement),
  }))

  const missing = requirements.filter((r) => r.isMandatory && !r.met)

  return {
    providerType,
    requirements,
    missing,
    canSubmit: missing.length === 0,
  }
}

export class RegistrationError extends Error {
  constructor(
    public code: 'NOT_FOUND' | 'NOT_YOURS' | 'INCOMPLETE' | 'WRONG_STATUS',
    message: string,
  ) {
    super(message)
    this.name = 'RegistrationError'
  }
}

/** The one open application belonging to this person, or null. */
export async function myDraft(userId: string) {
  const [row] = await db
    .select()
    .from(businessApplications)
    .where(
      and(
        eq(businessApplications.applicantId, userId),
        inArray(businessApplications.status, [
          'DRAFT',
          'SUBMITTED',
          'UNDER_REVIEW',
          'NEEDS_INFORMATION',
        ]),
      ),
    )
  return row ?? null
}

/**
 * Begin, or return the one already in progress.
 *
 * Creating a second application for the same person is never right: two
 * reviewers would work on two halves of the same story. Choosing a different
 * provider type on an existing DRAFT changes it rather than starting again,
 * because somebody realising they are an informal business rather than an
 * individual should not lose what they typed.
 */
export async function startApplication(params: {
  userId: string
  providerType: ProviderType
}) {
  const existing = await myDraft(params.userId)

  if (existing) {
    if (existing.status !== 'DRAFT') return existing
    const [updated] = await db
      .update(businessApplications)
      .set({ providerType: params.providerType, updatedAt: new Date() })
      .where(eq(businessApplications.id, existing.id))
      .returning()
    return updated
  }

  const [created] = await db
    .insert(businessApplications)
    .values({
      applicantId: params.userId,
      providerType: params.providerType,
      // A name is required by the table and they have not chosen one yet.
      // Blank rather than a placeholder that might survive to a reviewer.
      businessName: '',
      status: 'DRAFT',
      draftStartedAt: new Date(),
      // NOT submittedAt. A draft has not been submitted, and setting it here
      // would put every unfinished application into the review queue's ordering
      // as though somebody were waiting on us.
    })
    .returning()

  return created
}

/** Save progress. Always allowed while it is a draft or being corrected. */
export async function saveDraft(params: {
  userId: string
  applicationId: string
  fields: Record<string, string | null>
}) {
  const [app] = await db
    .select({
      id: businessApplications.id,
      applicantId: businessApplications.applicantId,
      status: businessApplications.status,
    })
    .from(businessApplications)
    .where(eq(businessApplications.id, params.applicationId))

  if (!app) throw new RegistrationError('NOT_FOUND', 'No such application.')
  if (app.applicantId !== params.userId) {
    // Same message as not-found. Confirming that somebody else's application
    // exists is information they should not have.
    throw new RegistrationError('NOT_FOUND', 'No such application.')
  }
  if (app.status === 'APPROVED' || app.status === 'REJECTED') {
    throw new RegistrationError(
      'WRONG_STATUS',
      'This application has been decided and can no longer be edited.',
    )
  }

  const f = params.fields
  const set = (v: string | null | undefined) =>
    v === undefined ? undefined : v?.trim() || null

  await db
    .update(businessApplications)
    .set({
      businessName: f.businessName?.trim() || '',
      summary: set(f.summary),
      kind: (f.kind as never) ?? undefined,
      city: f.city?.trim() || 'Mutare',
      contactPhone: set(f.contactPhone),
      contactEmail: set(f.contactEmail),
      whatsapp: set(f.whatsapp),
      legalName: set(f.legalName),
      idType: set(f.idType),
      idNumber: set(f.idNumber),
      residentialAddress: set(f.residentialAddress),
      addressEvidenceType: set(f.addressEvidenceType),
      operatingArea: set(f.operatingArea),
      registrationNumber: set(f.registrationNumber),
      note: set(f.note),
      updatedAt: new Date(),
    })
    .where(eq(businessApplications.id, params.applicationId))
}

/**
 * Hand it to Musuwo.
 *
 * THE GATE. Re-reads readiness from the database and refuses if anything
 * mandatory is missing, whatever the form believed. The status written is
 * hard-coded to SUBMITTED - there is no path here to APPROVED, exactly as
 * signing up has no path to ADMIN.
 */
export async function submitApplication(params: {
  userId: string
  applicationId: string
}) {
  const [app] = await db
    .select({
      id: businessApplications.id,
      applicantId: businessApplications.applicantId,
      status: businessApplications.status,
    })
    .from(businessApplications)
    .where(eq(businessApplications.id, params.applicationId))

  if (!app || app.applicantId !== params.userId) {
    throw new RegistrationError('NOT_FOUND', 'No such application.')
  }
  if (app.status !== 'DRAFT' && app.status !== 'NEEDS_INFORMATION') {
    throw new RegistrationError(
      'WRONG_STATUS',
      'This application has already been sent to Musuwo.',
    )
  }

  const ready = await readiness(params.applicationId)
  if (!ready.canSubmit) {
    throw new RegistrationError(
      'INCOMPLETE',
      `Not quite ready. Still needed: ${ready.missing.map((m) => m.label).join(', ')}.`,
    )
  }

  const resubmission = app.status === 'NEEDS_INFORMATION'

  await db.transaction(async (tx) => {
    await tx
      .update(businessApplications)
      .set({
        // HARD-CODED. An applicant cannot set their own status.
        status: 'SUBMITTED',
        submittedAt: new Date(),
        infoRequested: null,
        infoDueAt: null,
        updatedAt: new Date(),
      })
      .where(eq(businessApplications.id, params.applicationId))

    await tx.insert(businessApplicationEvents).values({
      applicationId: params.applicationId,
      actorId: params.userId,
      event: resubmission ? 'RESUBMITTED' : 'SUBMITTED',
      toStatus: 'SUBMITTED',
      message: resubmission
        ? 'The applicant answered and sent it back.'
        : 'Sent to Musuwo for review.',
    })
  })
}
