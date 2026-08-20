/**
 * SERVER ONLY.
 *
 * Not enforced with the `server-only` package, deliberately. That package
 * throws the moment it is imported outside React's server condition, which
 * includes plain node - so adding it here would make this module impossible to
 * import from db/verify-*.mts, and the verify suites are how every rule on
 * this platform is proved rather than asserted.
 *
 * The guard that actually holds is structural: this module reaches @/db/client,
 * which pulls in the postgres driver, which cannot be bundled for a browser.
 * Importing it from a client component fails the build with "Can't resolve
 * 'fs'" - the same wall that keeps registration.ts out of the application form.
 * See lib/platform/provider-types.ts for the note on that.
 */
import { eq, inArray } from 'drizzle-orm'

import { db } from '@/db/client'
import { platformSettings } from '@/db/schema/platform'

/**
 * Reading platform configuration, in one place.
 *
 * `platform_settings` was already being read ad hoc in two services, each with
 * its own copy of the select, its own cast and its own fallback. That is fine
 * with two callers and unmanageable with the twelve the ranking engine adds:
 * the feed reads nine weights on every request, and nine separate round trips
 * to fetch nine integers would be the slowest thing on the page.
 *
 * WHY THE FALLBACK IS ALWAYS REQUIRED
 *
 * Every reader must supply a default. A missing settings row should degrade a
 * weight, not take the marketplace down, and a caller that has thought about
 * what "missing" means has usually thought about what the value is for. The
 * defaults here deliberately match the ones migration 0020 inserts, so the
 * behaviour is identical whether or not the row is present.
 *
 * WHY THE VALUE IS PARSED DEFENSIVELY
 *
 * The column is `jsonb`, so a number may arrive as a JSON number, and a value
 * edited by hand in the Supabase console may arrive as the string "30". Both
 * are the owner meaning thirty. Refusing the second would turn a plausible
 * console edit into a silently broken feed.
 */

function toNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value.trim())
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

export async function platformSetting(
  key: string,
  fallback: number,
): Promise<number> {
  const rows = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, key))
    .limit(1)

  return rows.length === 0 ? fallback : toNumber(rows[0].value, fallback)
}

/**
 * Several settings in one query.
 *
 * The feed needs all nine ranking weights together. Fetching them one at a
 * time works and is nine round trips per request; this is one.
 */
export async function platformSettings_many<K extends string>(
  wanted: Record<K, number>,
): Promise<Record<K, number>> {
  const keys = Object.keys(wanted) as K[]
  const rows = await db
    .select({ key: platformSettings.key, value: platformSettings.value })
    .from(platformSettings)
    .where(inArray(platformSettings.key, keys))

  const found = new Map(rows.map((r) => [r.key, r.value]))
  const out = {} as Record<K, number>
  for (const key of keys) {
    out[key] = toNumber(found.get(key), wanted[key])
  }
  return out
}
