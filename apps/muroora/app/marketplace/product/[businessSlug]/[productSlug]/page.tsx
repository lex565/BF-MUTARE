import { permanentRedirect } from 'next/navigation'

import { productPath } from '@/lib/musuwo-urls'

/**
 * The old product address. Kept, and pointed at the new one.
 *
 * This route was the working product page for a while, and links to it have
 * already been sent to people - it is the address the share button was putting
 * into WhatsApp messages, and it is what the marketplace listing linked to
 * once the routing bug was fixed. Deleting it would break every one of those.
 *
 * The canonical address is now /stores/{merchant}/product/{product}, which
 * puts the product inside the shop rather than beside it. See
 * lib/musuwo-urls.ts for why there is exactly one.
 *
 * `permanentRedirect` is a 308, so the method is preserved and search engines
 * move their index across rather than keeping two entries for one product. The
 * page itself does no database work: whether the product exists is the
 * destination's question, and answering it twice would mean two round trips
 * for every old link.
 */
export default async function LegacyProductRedirect({
  params,
}: {
  params: Promise<{ businessSlug: string; productSlug: string }>
}) {
  const { businessSlug, productSlug } = await params
  permanentRedirect(productPath(businessSlug, productSlug))
}
