'use server'

import { revalidatePath } from 'next/cache'

import {
  addInternalNote,
  approveApplication,
  claimApplication,
  rejectApplication,
  releaseApplication,
  requestInformation,
  ApplicationError,
} from '@/lib/platform/applications'
import { PlatformAuthError } from '@/lib/platform/auth'

/**
 * What a reviewer can do to an application.
 *
 * EVERY ONE OF THESE RE-CHECKS AUTHORISATION. The service functions call
 * `assertPermission` themselves, and that is deliberate rather than duplicated
 * effort: a server action is a public HTTP endpoint. Anybody who can sign in
 * can invoke it directly with any application id they like, whether or not a
 * button was ever rendered for them. The page hiding the Approve button is a
 * courtesy to the reviewer; the check inside `approveApplication` is what
 * actually stops it.
 *
 * They return state rather than throwing, so the form can say what went wrong
 * instead of the person meeting an error page and losing what they typed.
 */

export type ReviewState = {
  error?: string
  message?: string
  /**
   * A wa.me link the reviewer can click to send the same words on WhatsApp.
   *
   * Present whenever the applicant gave a usable number. Automated WhatsApp
   * needs the Meta Business API - paid, weeks to approve, and a verified
   * number Musuwo does not have - so this opens the reviewer's own WhatsApp
   * with the message already written. It costs nothing and works today; the
   * trade is that a person has to press it.
   */
  whatsappUrl?: string | null
}

/** Turn the two error types we raise deliberately into something readable. */
function explain(error: unknown): ReviewState {
  if (error instanceof PlatformAuthError || error instanceof ApplicationError) {
    return { error: error.message }
  }
  // Next implements redirect() by throwing; never swallow that.
  throw error
}

function refresh(id: string) {
  revalidatePath(`/super-admin/applications/${id}`)
  revalidatePath('/super-admin/applications')
  revalidatePath('/super-admin')
}

export async function claimAction(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const id = String(formData.get('id'))
  try {
    await claimApplication(id)
    refresh(id)
    return { message: 'You are reviewing this one.' }
  } catch (error) {
    return explain(error)
  }
}

export async function releaseAction(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const id = String(formData.get('id'))
  try {
    await releaseApplication(id)
    refresh(id)
    return { message: 'Put back in the queue.' }
  } catch (error) {
    return explain(error)
  }
}

export async function noteAction(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const id = String(formData.get('id'))
  try {
    await addInternalNote(id, String(formData.get('message') ?? ''))
    refresh(id)
    return { message: 'Note added. Only reviewers can see it.' }
  } catch (error) {
    return explain(error)
  }
}

export async function requestInfoAction(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const id = String(formData.get('id'))
  try {
    const notice = await requestInformation({
      id,
      message: String(formData.get('message') ?? ''),
    })
    refresh(id)

    // Say plainly whether they were actually told. "Request sent" when no
    // email went anywhere is how an application sits for three weeks with
    // everyone assuming the other side is slow.
    return {
      message: notice.emailed
        ? 'Asked. An email is on its way, and they can now edit and resubmit.'
        : `Recorded, and they can now edit and resubmit - but NOT emailed. ${notice.emailProblem ?? ''}`,
      whatsappUrl: notice.whatsappUrl,
    }
  } catch (error) {
    return explain(error)
  }
}

export async function rejectAction(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const id = String(formData.get('id'))
  try {
    const notice = await rejectApplication({
      id,
      reason: String(formData.get('reason') ?? ''),
    })
    refresh(id)
    return {
      message: notice.emailed
        ? 'Recorded, and they have been emailed the reason. The application and its history are kept.'
        : `Recorded, but NOT emailed. ${notice.emailProblem ?? ''}`,
      whatsappUrl: notice.whatsappUrl,
    }
  } catch (error) {
    return explain(error)
  }
}

export async function approveAction(
  _prev: ReviewState,
  formData: FormData,
): Promise<ReviewState> {
  const id = String(formData.get('id'))
  try {
    const result = await approveApplication({
      id,
      note: String(formData.get('note') ?? '') || undefined,
      status: formData.get('status') === 'ACTIVE' ? 'ACTIVE' : 'PILOT',
    })
    refresh(id)

    if (!result.created) {
      return {
        message: `Already approved — ${result.publicId}. Nothing was created a second time, and no second welcome email was sent.`,
      }
    }

    return {
      message: result.notice?.emailed
        ? `Approved. ${result.publicId} is live, the applicant owns it, and they have been emailed.`
        : `Approved. ${result.publicId} is live and the applicant owns it - but they were NOT emailed. ${result.notice?.emailProblem ?? ''}`,
      whatsappUrl: result.notice?.whatsappUrl,
    }
  } catch (error) {
    return explain(error)
  }
}
