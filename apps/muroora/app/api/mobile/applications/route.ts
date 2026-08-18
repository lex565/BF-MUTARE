import {
  mobileFail,
  mobileOk,
  mobileOptions,
  mobileUser,
} from '@/app/api/mobile/_lib'
import {
  RegistrationError,
  acceptedAddressEvidence,
  myDraft,
  readiness,
  requirementsFor,
  saveDraft,
  startApplication,
  submitApplication,
  type ProviderType,
} from '@/lib/platform/registration'
import { listDocuments } from '@/lib/platform/documents'

export const dynamic = 'force-dynamic'
export const OPTIONS = mobileOptions

/**
 * Registering a business, from the phone.
 *
 * WHY THIS ENDPOINT EXISTS. The app had a three-step business application that
 * ended in `Alert.alert('Preview submitted')` and wrote nothing at all. Anybody
 * applying from their phone believed they had applied, nothing reached the
 * review queue, and neither side knew: the applicant assumed they were being
 * ignored, and Musuwo never knew they existed. For a pilot that is the worst
 * kind of failure, because it is invisible from both ends.
 *
 * IT SHARES THE WEBSITE'S RULES EXACTLY - the same `startApplication`,
 * `saveDraft`, `readiness` and `submitApplication`, not a parallel
 * implementation. So the phone cannot drift into accepting something the
 * website refuses, and cannot submit an application with no ID photo.
 */

/** Everything the phone needs to draw the whole flow in one round trip. */
export async function GET(request: Request) {
  const user = await mobileUser(request)
  if (!user) return mobileFail('UNAUTHENTICATED', 'Sign in first.', 401)

  const draft = await myDraft(user.id)

  if (!draft) {
    return mobileOk({
      application: null,
      readiness: null,
      documents: [],
      addressEvidence: await acceptedAddressEvidence(),
    })
  }

  const [ready, documents, evidence] = await Promise.all([
    readiness(draft.id),
    listDocuments(draft.id),
    acceptedAddressEvidence(),
  ])

  return mobileOk({
    application: {
      id: draft.id,
      status: draft.status,
      providerType: draft.providerType,
      businessName: draft.businessName,
      summary: draft.summary,
      kind: draft.kind,
      city: draft.city,
      contactPhone: draft.contactPhone,
      contactEmail: draft.contactEmail,
      whatsapp: draft.whatsapp,
      legalName: draft.legalName,
      idType: draft.idType,
      idNumber: draft.idNumber,
      residentialAddress: draft.residentialAddress,
      addressEvidenceType: draft.addressEvidenceType,
      operatingArea: draft.operatingArea,
      registrationNumber: draft.registrationNumber,
      note: draft.note,
      // What Musuwo asked for, so the phone can show it rather than leaving
      // somebody wondering why their application came back to them.
      infoRequested: draft.infoRequested,
    },
    readiness: ready,
    documents: documents.map((d) => d.kind),
    addressEvidence: evidence,
  })
}

/**
 * start | save | submit | requirements.
 *
 * One endpoint taking an action rather than four routes, because the phone is
 * often on a connection where every extra round trip is another chance to fail.
 */
export async function POST(request: Request) {
  const user = await mobileUser(request)
  if (!user) return mobileFail('UNAUTHENTICATED', 'Sign in first.', 401)

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return mobileFail('BAD_REQUEST', 'Send JSON.', 400)
  }

  const action = String(body.action ?? '')

  try {
    if (action === 'start') {
      const created = await startApplication({
        userId: user.id,
        providerType: String(body.providerType) as ProviderType,
      })
      return mobileOk({ applicationId: created.id, status: created.status })
    }

    if (action === 'save') {
      const applicationId = String(body.applicationId)
      await saveDraft({
        userId: user.id,
        applicationId,
        fields: (body.fields ?? {}) as Record<string, string | null>,
      })
      return mobileOk({ saved: true, readiness: await readiness(applicationId) })
    }

    if (action === 'submit') {
      // Re-checks completeness on the server, exactly as the website does. A
      // disabled button on the phone is a courtesy, never the control.
      await submitApplication({
        userId: user.id,
        applicationId: String(body.applicationId),
      })
      return mobileOk({ submitted: true })
    }

    if (action === 'requirements') {
      return mobileOk({
        requirements: await requirementsFor(
          String(body.providerType) as ProviderType,
        ),
      })
    }

    return mobileFail('BAD_REQUEST', `Unknown action "${action}".`, 400)
  } catch (error) {
    if (error instanceof RegistrationError) {
      // INCOMPLETE is not a server error - it is the gate working, and the
      // message names exactly what is still missing.
      return mobileFail(
        error.code,
        error.message,
        error.code === 'INCOMPLETE' ? 422 : 400,
      )
    }
    throw error
  }
}
