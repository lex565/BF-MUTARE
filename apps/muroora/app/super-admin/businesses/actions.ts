'use server'

import { revalidatePath } from 'next/cache'

import {
  ApplicationError,
  setBusinessVerification,
} from '@/lib/platform/applications'
import { PlatformAuthError } from '@/lib/platform/auth'

export type VerifyState = { error?: string; message?: string }

/**
 * Record or withdraw a licence check.
 *
 * The permission is asserted inside `setBusinessVerification`, not here, so a
 * future caller of the same service cannot skip it.
 */
export async function verifyAction(
  _prev: VerifyState,
  formData: FormData,
): Promise<VerifyState> {
  const withdraw = formData.get('withdraw') === '1'
  try {
    await setBusinessVerification({
      businessId: String(formData.get('businessId')),
      licenceNumber: withdraw ? null : String(formData.get('licenceNumber') ?? ''),
      reason: String(formData.get('reason') ?? '') || undefined,
    })
    revalidatePath('/super-admin/businesses')
    revalidatePath('/marketplace')
    return {
      message: withdraw
        ? 'Verification withdrawn. The badge is gone from the directory.'
        : 'Recorded. Customers now see a Verified badge on this business.',
    }
  } catch (error) {
    if (error instanceof ApplicationError || error instanceof PlatformAuthError) {
      return { error: error.message }
    }
    throw error
  }
}
