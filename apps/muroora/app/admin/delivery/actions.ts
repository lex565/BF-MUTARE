'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireRole } from '@/lib/auth'
import {
  ZoneError,
  createZone,
  setZoneActive,
  updateZone,
} from '@/lib/services/delivery-admin'

export type ZoneFormState = { error?: string; message?: string }

const minutes = z.coerce.number().int().min(1).max(1440).optional()

const createInput = z.object({
  name: z.string().trim().min(1, 'Give the area a name.').max(80),
  description: z.string().trim().max(300).optional(),
  suburbs: z.string().trim().min(1, 'List the suburbs it covers.'),
  fee: z.string().trim().min(1, 'What does delivery there cost?'),
  minimumOrder: z.string().trim().optional(),
  estimatedMinutesMin: minutes,
  estimatedMinutesMax: minutes,
})

export async function createZoneAction(
  _prev: ZoneFormState,
  formData: FormData,
): Promise<ZoneFormState> {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN')

  const raw = Object.fromEntries(formData)
  const parsed = createInput.safeParse({
    ...raw,
    estimatedMinutesMin: raw.estimatedMinutesMin || undefined,
    estimatedMinutesMax: raw.estimatedMinutesMax || undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await createZone(parsed.data, admin.id)
    revalidatePath('/admin/delivery')
    return { message: `${parsed.data.name} added.` }
  } catch (error) {
    if (error instanceof ZoneError) return { error: error.message }
    console.error('[createZoneAction]', error)
    return { error: 'Could not add that area.' }
  }
}

const updateInput = z.object({
  id: z.string().uuid(),
  name: z.string().trim().max(80).optional(),
  suburbs: z.string().trim().optional(),
  fee: z.string().trim().optional(),
  minimumOrder: z.string().trim().optional(),
})

export async function updateZoneAction(
  _prev: ZoneFormState,
  formData: FormData,
): Promise<ZoneFormState> {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN')

  const parsed = updateInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Those values do not look right.' }

  try {
    await updateZone(parsed.data, admin.id)
    revalidatePath('/admin/delivery')
    return { message: 'Saved.' }
  } catch (error) {
    if (error instanceof ZoneError) return { error: error.message }
    console.error('[updateZoneAction]', error)
    return { error: 'Could not save that.' }
  }
}

const activeInput = z.object({
  id: z.string().uuid(),
  isActive: z.enum(['true', 'false']),
})

export async function setZoneActiveAction(
  _prev: ZoneFormState,
  formData: FormData,
): Promise<ZoneFormState> {
  const admin = await requireRole('ADMIN', 'SUPER_ADMIN')

  const parsed = activeInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Could not read that.' }

  try {
    const { openOrders } = await setZoneActive(
      { id: parsed.data.id, isActive: parsed.data.isActive === 'true' },
      admin.id,
    )
    revalidatePath('/admin/delivery')

    if (parsed.data.isActive === 'false' && openOrders > 0) {
      return {
        message:
          `Switched off. Note: ${openOrders} order${openOrders === 1 ? '' : 's'} ` +
          `already placed for that area still need delivering.`,
      }
    }
    return {
      message: parsed.data.isActive === 'true' ? 'Back on.' : 'Switched off.',
    }
  } catch (error) {
    if (error instanceof ZoneError) return { error: error.message }
    console.error('[setZoneActiveAction]', error)
    return { error: 'Could not change that.' }
  }
}
