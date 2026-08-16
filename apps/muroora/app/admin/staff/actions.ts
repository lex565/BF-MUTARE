'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireAdminWrite } from '@/lib/auth'
import {
  GRANTABLE_ROLES,
  StaffError,
  findAccounts,
  promoteToStaff,
  revokeRole,
  setStaffStatus,
  type StaffMember,
} from '@/lib/services/staff'

/**
 * Staff admin actions. Thin wrappers - role check, validate, call the service.
 *
 * Every one requires ADMIN. SHOP_STAFF explicitly cannot reach these: a staff
 * member who could promote themselves to admin makes the whole role system
 * decorative.
 */

export type StaffFormState = {
  error?: string
  message?: string
  results?: StaffMember[]
}

const searchInput = z.object({
  query: z.string().trim().min(3, 'Type at least three characters.'),
})

export async function searchAccountsAction(
  _prev: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  await requireAdminWrite()

  const parsed = searchInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const results = await findAccounts(parsed.data.query)
  return {
    results,
    message:
      results.length === 0
        ? 'Nobody found. They need to create an account at /login first.'
        : undefined,
  }
}

const promoteInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(GRANTABLE_ROLES),
  jobTitle: z.string().trim().max(120).optional().or(z.literal('')),
})

export async function promoteAction(
  _prev: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const admin = await requireAdminWrite()

  const parsed = promoteInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    const { staffNumber } = await promoteToStaff(
      {
        userId: parsed.data.userId,
        role: parsed.data.role,
        jobTitle: parsed.data.jobTitle || undefined,
      },
      admin.id,
    )

    revalidatePath('/admin/staff')
    return { message: `Done - staff number ${staffNumber}.` }
  } catch (error) {
    if (error instanceof StaffError) return { error: error.message }
    console.error('[promoteAction]', error)
    return { error: 'Could not grant that.' }
  }
}

const revokeInput = z.object({
  userId: z.string().uuid(),
  role: z.enum(GRANTABLE_ROLES),
})

export async function revokeAction(
  _prev: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const admin = await requireAdminWrite()

  const parsed = revokeInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await revokeRole(parsed.data, admin.id)
    revalidatePath('/admin/staff')
    return { message: 'Access removed.' }
  } catch (error) {
    if (error instanceof StaffError) return { error: error.message }
    console.error('[revokeAction]', error)
    return { error: 'Could not remove that.' }
  }
}

const statusInput = z.object({
  userId: z.string().uuid(),
  status: z.enum(['ACTIVE', 'SUSPENDED', 'LEFT']),
  notes: z.string().trim().max(500).optional().or(z.literal('')),
})

export async function setStatusAction(
  _prev: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const admin = await requireAdminWrite()

  const parsed = statusInput.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  try {
    await setStaffStatus(
      { ...parsed.data, notes: parsed.data.notes || undefined },
      admin.id,
    )
    revalidatePath('/admin/staff')
    return {
      message:
        parsed.data.status === 'ACTIVE'
          ? 'Back on the team.'
          : 'Status changed, and their access has been removed.',
    }
  } catch (error) {
    if (error instanceof StaffError) return { error: error.message }
    console.error('[setStatusAction]', error)
    return { error: 'Could not change that.' }
  }
}
