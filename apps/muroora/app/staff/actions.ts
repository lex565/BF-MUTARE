'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { db } from '@/db/client'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { requireRole } from '@/lib/auth'
import { StaffError } from '@/lib/services/staff'
import { updateStaffProfile } from '@/lib/services/staff'
import { uploadStaffPhoto } from '@/lib/services/staff-photo'
import { normalisePhone } from '@/lib/services/orders'

/**
 * What a staff member may change about themselves.
 *
 * Their name, phone, job title and photograph. NOT their roles, NOT their
 * staff number, NOT their employment status — those belong to an admin, and
 * a self-service route to any of them would make the People screen decorative.
 */

export type ProfileState = { error?: string; message?: string }

const profileInput = z.object({
  fullName: z.string().trim().min(1, 'Your name cannot be blank.').max(120),
  phone: z
    .string()
    .trim()
    .max(20)
    .optional()
    .or(z.literal('')),
  jobTitle: z.string().trim().max(120).optional().or(z.literal('')),
})

export async function updateMyProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const me = await requireRole('SHOP_STAFF', 'ADMIN', 'SUPER_ADMIN', 'VIEWER')

  const parsed = profileInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await db
      .update(users)
      .set({
        fullName: parsed.data.fullName,
        phone: parsed.data.phone ? normalisePhone(parsed.data.phone) : null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, me.id))

    if (parsed.data.jobTitle) {
      await updateStaffProfile(
        { userId: me.id, jobTitle: parsed.data.jobTitle },
        me.id,
      )
    }

    revalidatePath('/staff')
    return { message: 'Saved.' }
  } catch (error) {
    if (error instanceof StaffError) return { error: error.message }
    console.error('[updateMyProfileAction]', error)
    return { error: 'Could not save that.' }
  }
}

export async function uploadMyPhotoAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const me = await requireRole('SHOP_STAFF', 'ADMIN', 'SUPER_ADMIN', 'VIEWER')

  const file = formData.get('photo')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose a photo first.' }
  }

  try {
    await uploadStaffPhoto({ userId: me.id, file, actorId: me.id })
    revalidatePath('/staff')
    return { message: 'Photo saved. Your staff tools are open now.' }
  } catch (error) {
    if (error instanceof StaffError) return { error: error.message }
    console.error('[uploadMyPhotoAction]', error)
    return { error: 'Could not save that photo.' }
  }
}
