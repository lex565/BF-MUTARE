import { HomeShell } from '@/app/components/shop/HomeShell'
import { MusuwoHomeShell } from '@/app/components/marketplace/MusuwoHomeShell'
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
 */
export default function HomePage() {
  return isMuroora ? <HomeShell /> : <MusuwoHomeShell />
}
