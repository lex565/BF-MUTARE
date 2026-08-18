'use server'

import { revalidatePath } from 'next/cache'

import {
  AdminError,
  promoteToSuperAdmin,
  setAdminStatus,
  setPermissions,
} from '@/lib/platform/admins'
import { PlatformAuthError } from '@/lib/platform/auth'

/**
 * Owner-only actions.
 *
 * None of these check that the caller is the owner - the service functions do,
 * with `assertPlatformOwner`, which throws. That is on purpose: putting the
 * check only here would mean a new caller of the same service could skip it.
 * The boundary belongs next to the thing it protects.
 */

export type AdminState = { error?: string; message?: string }

function explain(error: unknown): AdminState {
  if (error instanceof AdminError || error instanceof PlatformAuthError) {
    return { error: error.message }
  }
  throw error
}

function refresh() {
  revalidatePath('/super-admin/admins')
  revalidatePath('/super-admin')
}

export async function promoteAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const result = await promoteToSuperAdmin({
      email: String(formData.get('email') ?? ''),
      permissions: formData.getAll('permissions').map(String),
    })
    refresh()
    return {
      message: `${result.name ?? 'That account'} is now a Super Admin. They see the Control Center on their next visit.`,
    }
  } catch (error) {
    return explain(error)
  }
}

export async function permissionsAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    await setPermissions({
      platformRoleId: String(formData.get('platformRoleId')),
      permissions: formData.getAll('permissions').map(String),
    })
    refresh()
    return { message: 'Permissions saved. They take effect immediately.' }
  } catch (error) {
    return explain(error)
  }
}

export async function statusAction(
  _prev: AdminState,
  formData: FormData,
): Promise<AdminState> {
  try {
    const status = String(formData.get('status')) as
      | 'ACTIVE'
      | 'SUSPENDED'
      | 'DEACTIVATED'
    await setAdminStatus({
      platformRoleId: String(formData.get('platformRoleId')),
      status,
      reason: String(formData.get('reason') ?? '') || undefined,
    })
    refresh()
    return {
      message:
        status === 'ACTIVE'
          ? 'Reactivated.'
          : 'Access removed. Their history is kept.',
    }
  } catch (error) {
    return explain(error)
  }
}
