'use server'

import { revalidatePath } from 'next/cache'

import {
  blockRelease,
  createRelease,
  deprecateRelease,
  publishRelease,
  setPublicBeta,
  updateRelease,
  ReleaseError,
} from '@/lib/platform/releases'
import { PlatformAuthError } from '@/lib/platform/auth'

export type ReleaseState = { error?: string; message?: string }

function explain(error: unknown): ReleaseState {
  if (error instanceof ReleaseError || error instanceof PlatformAuthError) {
    return { error: error.message }
  }
  throw error
}

/** Everything a release change touches, including the public beta page. */
function refresh() {
  revalidatePath('/super-admin/releases')
  revalidatePath('/beta')
}

export async function createReleaseAction(
  _prev: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  try {
    const size = String(formData.get('fileSizeMb') ?? '').trim()
    await createRelease({
      platform: formData.get('platform') === 'IOS' ? 'IOS' : 'ANDROID',
      version: String(formData.get('version') ?? ''),
      buildNumber: Number(formData.get('buildNumber')) || null,
      downloadUrl: String(formData.get('downloadUrl') ?? '') || null,
      releaseNotes: String(formData.get('releaseNotes') ?? '') || null,
      knownIssues: String(formData.get('knownIssues') ?? '') || null,
      minSupportedVersion: String(formData.get('minSupportedVersion') ?? '') || null,
      // Entered in MB because that is what a person reads off a file listing.
      fileSizeBytes: size ? Math.round(Number(size) * 1024 * 1024) : null,
      isMandatory: formData.get('isMandatory') === 'on',
    })
    refresh()
    return { message: 'Recorded as a draft. Publish it when you are ready.' }
  } catch (error) {
    return explain(error)
  }
}

export async function publishReleaseAction(
  _prev: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  try {
    await publishRelease(String(formData.get('id')))
    refresh()
    return { message: 'Published. /beta and /beta/android now serve this build.' }
  } catch (error) {
    return explain(error)
  }
}

export async function blockReleaseAction(
  _prev: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  try {
    await blockRelease({
      id: String(formData.get('id')),
      reason: String(formData.get('reason') ?? ''),
    })
    refresh()
    return {
      message:
        'Blocked. Anyone running it is now told to update before they can continue.',
    }
  } catch (error) {
    return explain(error)
  }
}

export async function deprecateReleaseAction(
  _prev: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  try {
    await deprecateRelease(String(formData.get('id')))
    refresh()
    return { message: 'Retired. It is no longer offered.' }
  } catch (error) {
    return explain(error)
  }
}

export async function updateReleaseAction(
  _prev: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  try {
    await updateRelease({
      id: String(formData.get('id')),
      downloadUrl: String(formData.get('downloadUrl') ?? '') || null,
      releaseNotes: String(formData.get('releaseNotes') ?? '') || null,
      knownIssues: String(formData.get('knownIssues') ?? '') || null,
      minSupportedVersion: String(formData.get('minSupportedVersion') ?? '') || null,
      isMandatory: formData.get('isMandatory') === 'on',
    })
    refresh()
    return { message: 'Saved.' }
  } catch (error) {
    return explain(error)
  }
}

export async function setPublicBetaAction(
  _prev: ReleaseState,
  formData: FormData,
): Promise<ReleaseState> {
  try {
    const open = formData.get('enabled') === '1'
    await setPublicBeta(open)
    refresh()
    return {
      message: open
        ? 'The beta page is open.'
        : 'The beta page is closed. No download is served until you reopen it.',
    }
  } catch (error) {
    return explain(error)
  }
}
