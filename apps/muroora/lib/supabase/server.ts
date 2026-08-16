import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase clients for server code.
 *
 * Two of them, and the difference matters enormously:
 *
 * `supabaseServer()` acts AS THE SIGNED-IN USER. Every permission rule in the
 * database applies. This is what almost all code should use.
 *
 * `supabaseAdmin()` uses the service-role key and IGNORES EVERY PERMISSION
 * RULE. It exists for the handful of operations that legitimately need to act
 * outside any user - creating the first admin, a scheduled job. Reaching for
 * it because something returned "not allowed" is how a system quietly loses
 * all its access control.
 */

export async function supabaseServer() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Called from a Server Component, where cookies cannot be written.
            // Harmless: the middleware refreshes the session on every request,
            // so the cookie is kept current there instead.
          }
        },
      },
    },
  )
}

/**
 * Service-role client. SERVER ONLY.
 *
 * Bypasses row-level security completely. Anything holding this key can read
 * every customer's address and, once Phase 3 exists, every rider's identity
 * document. It is never imported into a client component, never logged, and
 * the key never carries a NEXT_PUBLIC_ prefix.
 */
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.')
  }

  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    cookies: { getAll: () => [], setAll: () => {} },
  })
}
