'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'

import { db } from '@/db/client'
import { userRoles, users } from '@/db/schema'
import { supabaseServer } from '@/lib/supabase/server'

/**
 * Sign in and sign up.
 *
 * THE RULE THAT MATTERS: signing up grants CUSTOMER and nothing else, ever.
 * The role is hard-coded below — it is not read from the form, so no amount of
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
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error) {
    // Deliberately not "no account with that email" — that tells an attacker
    // which addresses are registered.
    return { error: 'That email and password do not match.' }
  }

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

  revalidatePath('/', 'layout')
  redirect(safeNext(parsed.data.next))
}

export async function signOut() {
  const supabase = await supabaseServer()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
