'use server'

import { submitBetaFeedback, ReleaseError } from '@/lib/platform/releases'
import { currentUser } from '@/lib/auth'

export type FeedbackState = { error?: string; message?: string }

/**
 * A tester's report.
 *
 * OPEN TO PEOPLE WHO ARE NOT SIGNED IN, on purpose. The most valuable report a
 * beta can receive is "I cannot sign in", and requiring a session to say so
 * would silence exactly that person.
 *
 * It records the signed-in account when there is one, because a report you can
 * ask a follow-up question about is worth several you cannot.
 */
export async function submitFeedbackAction(
  _prev: FeedbackState,
  formData: FormData,
): Promise<FeedbackState> {
  try {
    // Never read from the form. A hidden field naming the reporter is a hidden
    // field anybody can edit.
    const user = await currentUser().catch(() => null)

    await submitBetaFeedback({
      userId: user?.id ?? null,
      kind: String(formData.get('kind') ?? 'BUG'),
      message: String(formData.get('message') ?? ''),
      appVersion: String(formData.get('appVersion') ?? '') || null,
      device: String(formData.get('device') ?? '') || null,
      contact: String(formData.get('contact') ?? '') || null,
    })

    const security = formData.get('kind') === 'SECURITY'

    return {
      message: security
        ? 'Thank you. Security reports are kept private and are not shown on any shared list. Somebody will look at it.'
        : 'Thank you. That is genuinely useful.',
    }
  } catch (error) {
    if (error instanceof ReleaseError) return { error: error.message }
    throw error
  }
}
