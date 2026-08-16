'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireRole } from '@/lib/auth'
import { cancelShopHandover, RiderError, startShopHandover } from '@/lib/services/riders'

export type HandoverState = { error?: string; message?: string }

const startInput = z.object({ deliveryId: z.string().uuid() }).strict()

export async function startHandoverAction(
  _previous: HandoverState,
  formData: FormData,
): Promise<HandoverState> {
  const staff = await requireRole('SHOP_STAFF', 'ADMIN', 'SUPER_ADMIN')
  const parsed = startInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'That delivery could not be read.' }
  try {
    await startShopHandover(parsed.data.deliveryId, staff.id)
    revalidatePath('/staff/deliveries')
    return { message: 'Package checked. Ask the rider to confirm collection.' }
  } catch (error) {
    if (error instanceof RiderError) return { error: error.message }
    console.error('[startHandoverAction]', error)
    return { error: 'Could not start handover.' }
  }
}

const cancelInput = z.object({
  deliveryId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
}).strict()

export async function cancelHandoverAction(
  _previous: HandoverState,
  formData: FormData,
): Promise<HandoverState> {
  const staff = await requireRole('SHOP_STAFF', 'ADMIN', 'SUPER_ADMIN')
  const parsed = cancelInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: parsed.error.issues[0].message }
  try {
    await cancelShopHandover(parsed.data.deliveryId, staff.id, parsed.data.reason)
    revalidatePath('/staff/deliveries')
    return { message: 'Handover cancelled. The goods remain in shop custody.' }
  } catch (error) {
    if (error instanceof RiderError) return { error: error.message }
    console.error('[cancelHandoverAction]', error)
    return { error: 'Could not cancel handover.' }
  }
}
