'use server'

import { redirect } from 'next/navigation'
import { z } from 'zod'

import { currentUser } from '@/lib/auth'
import { MarketplaceError, applyForBusiness } from '@/lib/services/marketplace'

/**
 * Apply to list a business on Musuwo.
 *
 * REAL, not a preview. It writes a row to `business_applications` with status
 * SUBMITTED and stops there.
 *
 * IT CANNOT CREATE A BUSINESS AND IT CANNOT GRANT A ROLE. Approval is a
 * separate act by a platform administrator, for the same reason there is no
 * self-service route to staff access: an application that approves itself is
 * not an application. That rule is in the service, not here, so a second entry
 * point cannot bypass it.
 */

export type ApplyState = { error?: string; message?: string }

const application = z.object({
  businessName: z
    .string()
    .trim()
    .min(2, 'What is the business called?')
    .max(120),
  kind: z.enum(['RETAIL', 'FOOD', 'ACCOMMODATION', 'SERVICE', 'OTHER']),
  city: z.string().trim().min(2, 'Which town or city?').max(80),
  contactPhone: z.string().trim().max(40).optional().or(z.literal('')),
  contactEmail: z
    .string()
    .trim()
    .toLowerCase()
    .email('That does not look like an email address.')
    .optional()
    .or(z.literal('')),
  note: z.string().trim().max(2000).optional().or(z.literal('')),
})

export async function submitApplication(
  _prev: ApplyState,
  formData: FormData,
): Promise<ApplyState> {
  // Signed in first. An application from nobody cannot be reviewed, replied
  // to, or turned into a business with an owner.
  const user = await currentUser()
  if (!user) {
    redirect('/login?next=/marketplace/apply')
  }

  const parsed = application.safeParse({
    businessName: formData.get('businessName'),
    kind: formData.get('kind'),
    city: formData.get('city'),
    contactPhone: formData.get('contactPhone') ?? '',
    contactEmail: formData.get('contactEmail') ?? '',
    note: formData.get('note') ?? '',
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await applyForBusiness({
      applicantId: user.id,
      businessName: parsed.data.businessName,
      kind: parsed.data.kind,
      city: parsed.data.city,
      contactPhone: parsed.data.contactPhone || undefined,
      contactEmail: parsed.data.contactEmail || undefined,
      note: parsed.data.note || undefined,
    })
  } catch (error) {
    if (error instanceof MarketplaceError) {
      return { error: error.message }
    }
    console.error('[submitApplication]', error)
    return { error: 'That could not be submitted. Please try again.' }
  }

  return {
    message:
      'Application received. Somebody will review it and come back to you. ' +
      'Nothing is listed on Musuwo until it has been approved.',
  }
}
