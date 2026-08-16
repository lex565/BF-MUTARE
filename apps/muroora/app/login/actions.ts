'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { CART_COOKIE_NAME } from '@/app/api/_lib/cart-owner'
import { db } from '@/db/client'
import { userRoles, users } from '@/db/schema'
import { mergeGuestCart } from '@/lib/services/cart'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Sign in and sign up.
 *
 * THE RULE THAT MATTERS: signing up grants CUSTOMER and nothing else, ever.
 * The role is hard-coded below - it is not read from the form, so no amount of
 * tampering with the request can ask for ADMIN. Staff and rider privileges are
 * granted afterwards by someone who already has them, writing to a table this
 * path never touches. That is the brief's rule 7, made structural rather than
 * a matter of remembering.
 */

const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID!

const credentials = z.object({
  email: z.string().trim().toLowerCase().email('That does not look like an email address.'),
  password: z.string().min(8, 'Use at least 8 characters.'),
  fullName: z.string().trim().max(120).optional(),
  next: z.string().optional(),
})

export type AuthState = { error?: string; message?: string }

/** Only allow same-site redirects. An open redirect is a phishing vector. */
function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return '/account'
  return next
}

/**
 * Carry a guest cart into the account being signed into.
 *
 * Without this, somebody who fills a basket and then signs in to check out
 * watches it empty - which is the most effective way there is to lose a sale
 * at the last step.
 *
 * Never allowed to break the sign-in. A cart is recoverable; being unable to
 * log in is not, so a failure here is logged and swallowed.
 */
async function carryCartOver(authId: string): Promise<void> {
  try {
    const jar = await cookies()
    const token = jar.get(CART_COOKIE_NAME)?.value
    if (!token) return

    const [row] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.authId, authId))

    if (!row) return

    await mergeGuestCart(token, row.id)
    jar.delete(CART_COOKIE_NAME)
  } catch (error) {
    console.error('[carryCartOver]', error)
  }
}

export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await supabaseServer()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    // Deliberately not "no account with that email" - that tells an attacker
    // which addresses are registered.
    return { error: 'That email and password do not match.' }
  }

  if (data.user) await carryCartOver(data.user.id)

  revalidatePath('/', 'layout')
  redirect(safeNext(parsed.data.next))
}

export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = credentials.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    fullName: formData.get('fullName') ?? undefined,
    next: formData.get('next') ?? undefined,
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await supabaseServer()
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName ?? null } },
  })

  if (error) {
    return { error: error.message }
  }
  if (!data.user) {
    return { message: 'Check your email to confirm your account.' }
  }

  // The application-side row and its single role grant.
  const [row] = await db
    .insert(users)
    .values({
      authId: data.user.id,
      email: parsed.data.email,
      fullName: parsed.data.fullName ?? null,
    })
    .onConflictDoNothing({ target: users.authId })
    .returning()

  const userId =
    row?.id ??
    (
      await db.select().from(users).where(eq(users.authId, data.user.id))
    )[0]?.id

  if (userId) {
    const existing = await db
      .select()
      .from(userRoles)
      .where(and(eq(userRoles.userId, userId), eq(userRoles.storeId, STORE_ID)))

    if (existing.length === 0) {
      await db.insert(userRoles).values({
        userId,
        // HARD-CODED. Never read from the form. See the note at the top.
        role: 'CUSTOMER',
        storeId: STORE_ID,
      })
    }
  }

  await carryCartOver(data.user.id)

  revalidatePath('/', 'layout')
  redirect(safeNext(parsed.data.next))
}

/**
 * End the session.
 *
 * The signOut call is wrapped because supabase-js THROWS "Auth session
 * missing!" when there is nothing to sign out of, and that is not an error
 * from the person's point of view: it happens when a token has already
 * lapsed, when they signed out in another tab, or when the idle timer fires
 * on a session that had already gone. In every one of those cases the right
 * answer is the one they asked for, which is to end up signed out.
 *
 * The catch is around the signOut alone, NOT the redirect. Next implements
 * redirect() by throwing, so a try block wrapped around both would swallow
 * the navigation and leave the person sitting on the page.
 */
async function endSession() {
  try {
    const supabase = await supabaseServer()
    await supabase.auth.signOut()
  } catch (error) {
    console.warn('[signOut] no session to end:', (error as Error).message)
  }
}

export async function signOut() {
  await endSession()
  revalidatePath('/', 'layout')
  redirect('/')
}

/* ------------------------------------------------------- password reset */

const emailOnly = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('That does not look like an email address.'),
})

/**
 * Send a reset link.
 *
 * ALWAYS reports success, even when there is no such account. Saying "no
 * account with that email" turns this form into a way of discovering who
 * shops here - and for a staff login, who works here. The person who owns the
 * address learns everything they need from the email itself.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = emailOnly.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await supabaseServer()
  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://muroora-mart.vercel.app'

  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    { redirectTo: `${origin}/reset-password` },
  )

  // Logged, not shown. A provider outage is our problem, not a hint to hand
  // to whoever is typing addresses into this box.
  if (error) console.error('[requestPasswordReset]', error.message)

  return {
    message:
      'If there is an account with that address, a link is on its way. It ' +
      'lasts one hour. Check your spam folder if it does not arrive.',
  }
}

const newPassword = z
  .object({
    password: z
      .string()
      .min(10, 'Use at least 10 characters - length beats punctuation.')
      .max(200),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: 'Those two do not match.',
    path: ['confirm'],
  })

/**
 * Set a new password from a reset link.
 *
 * Requires the recovery session the link established. `getUser()` verifies it
 * with Supabase rather than trusting the cookie, so a forged or expired token
 * lands here with nobody signed in and is refused.
 */
export async function completePasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = newPassword.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await supabaseServer()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error:
        'That link has expired or has already been used. Ask for a new one.',
    }
  }

  let failed: string | null = null
  try {
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    })
    if (error) failed = error.message
  } catch (error) {
    // Thrown rather than returned when the recovery session has lapsed.
    failed =
      'That link is no longer valid. Ask for a new one and open it straight away.'
    console.warn('[completePasswordReset]', (error as Error).message)
  }

  if (failed) return { error: failed }

  redirect('/account?reset=1')
}

/**
 * Sign out because nothing has happened for half an hour.
 *
 * Separate from `signOut` so the person lands somewhere that explains itself,
 * rather than on the homepage wondering what happened.
 */
export async function signOutIdle() {
  await endSession()
  revalidatePath('/', 'layout')
  redirect('/login?idle=1')
}
