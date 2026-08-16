import { mobileFail, mobileOk, mobileOptions, mobileUser } from '../_lib'

export const dynamic = 'force-dynamic'
export const OPTIONS = mobileOptions

export async function GET(request: Request) {
  const user = await mobileUser(request)
  if (!user) return mobileFail('UNAUTHENTICATED', 'Sign in again to continue.', 401)
  return mobileOk({ id: user.id, email: user.email, fullName: user.fullName, roles: user.roles })
}
