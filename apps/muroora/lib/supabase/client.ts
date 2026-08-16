'use client'

import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase client for the browser.
 *
 * Uses the anon key, which is safe to ship in page source - it is designed to
 * be public and can only do what the database's permission rules allow. The
 * service-role key must never appear in a file with 'use client' at the top.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
