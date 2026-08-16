import { NextResponse } from 'next/server'

import { currentUserFromAccessToken, hasRole, type CurrentUser } from '@/lib/auth'

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, PATCH, OPTIONS',
}

export const mobileOk = <T>(data: T, init?: ResponseInit) =>
  NextResponse.json({ data }, { ...init, headers: { ...headers, ...init?.headers } })

export const mobileFail = (code: string, message: string, status: number) =>
  NextResponse.json({ error: { code, message } }, { status, headers })

export const mobileOptions = () => new NextResponse(null, { status: 204, headers })

export async function mobileUser(request: Request): Promise<CurrentUser | null> {
  const authorization = request.headers.get('authorization')
  if (!authorization?.startsWith('Bearer ')) return null
  return currentUserFromAccessToken(authorization.slice(7).trim())
}

export async function mobileAdmin(request: Request): Promise<CurrentUser | null> {
  const user = await mobileUser(request)
  return hasRole(user, 'ADMIN', 'SUPER_ADMIN') ? user : null
}
