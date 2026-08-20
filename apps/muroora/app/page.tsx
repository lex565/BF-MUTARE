import { HomeShell } from '@/app/components/shop/HomeShell'
import { MusuwoHome } from '@/app/components/marketplace/MusuwoHome'
import { isMuroora } from '@/lib/brand'

/**
 * The homepage, whichever site this is.
 *
 * Musuwo and Muroora Mart are separate websites served by the same
 * application, so `/` has to be whichever brand this deployment is. See
 * lib/brand.ts for why it is one codebase rather than two.
 *
 * Muroora Mart's storefront also stays reachable at /stores/muroora-mart on
 * both deployments. Musuwo links there when it lists the merchant, and the old
 * path keeps working rather than breaking every link that already points at it.
 *
 * Musuwo's side is a ranked product feed as of the For You work - see
 * MusuwoHome for what it replaced. It reads the database on every request and
 * personalises per session, so it cannot be statically rendered.
 */
export const dynamic = 'force-dynamic'

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>
}) {
  if (isMuroora) return <HomeShell />
  const { kind } = await searchParams
  return <MusuwoHome kind={kind} />
}
