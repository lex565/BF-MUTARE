'use server'

import { revalidatePath } from 'next/cache'

import { currentUser } from '@/lib/auth'
import {
  RegistrationError,
  saveDraft,
  startApplication,
  submitApplication,
  type ProviderType,
} from '@/lib/platform/registration'
import { DocumentError, uploadDocument, type DocumentKind } from '@/lib/platform/documents'

export type ApplyState = { error?: string; message?: string }

/**
 * The applicant's own actions.
 *
 * Every one of them resolves the signed-in person from the SESSION and never
 * from the form. A hidden field naming the applicant is a hidden field anybody
 * can edit, and the whole point of these checks is that the person editing the
 * page is the threat being defended against.
 */

function explain(error: unknown): ApplyState {
  if (error instanceof RegistrationError || error instanceof DocumentError) {
    return { error: error.message }
  }
  throw error
}

async function me() {
  const user = await currentUser()
  if (!user) {
    throw new RegistrationError('NOT_FOUND', 'Sign in first.')
  }
  return user
}

export async function startAction(
  _prev: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  try {
    const user = await me()
    await startApplication({
      userId: user.id,
      providerType: String(formData.get('providerType')) as ProviderType,
    })
    revalidatePath('/marketplace/apply')
    return { message: 'Started. Fill in what you have - it saves as you go.' }
  } catch (error) {
    return explain(error)
  }
}

export async function saveAction(
  _prev: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  try {
    const user = await me()
    const fields: Record<string, string | null> = {}
    for (const key of [
      'businessName', 'summary', 'kind', 'city', 'contactPhone', 'contactEmail',
      'whatsapp', 'legalName', 'idType', 'idNumber', 'residentialAddress',
      'addressEvidenceType', 'operatingArea', 'registrationNumber', 'note',
    ]) {
      const v = formData.get(key)
      if (v !== null) fields[key] = String(v)
    }

    await saveDraft({
      userId: user.id,
      applicationId: String(formData.get('applicationId')),
      fields,
    })
    revalidatePath('/marketplace/apply')
    return { message: 'Saved. You can close this and come back.' }
  } catch (error) {
    return explain(error)
  }
}

export async function uploadAction(
  _prev: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  try {
    const user = await me()
    const file = formData.get('file')
    if (!(file instanceof File) || file.size === 0) {
      return { error: 'Choose a file first.' }
    }

    await uploadDocument({
      userId: user.id,
      applicationId: String(formData.get('applicationId')),
      kind: String(formData.get('kind')) as DocumentKind,
      file,
    })
    revalidatePath('/marketplace/apply')
    return { message: 'Uploaded. Only Musuwo reviewers can open it.' }
  } catch (error) {
    return explain(error)
  }
}

export async function submitAction(
  _prev: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  try {
    const user = await me()
    // Re-checks completeness on the server whatever the button believed.
    await submitApplication({
      userId: user.id,
      applicationId: String(formData.get('applicationId')),
    })
    revalidatePath('/marketplace/apply')
    revalidatePath('/super-admin/applications')
    return {
      message:
        'Sent to Musuwo. A person reads every application - we will come back to you.',
    }
  } catch (error) {
    return explain(error)
  }
}
