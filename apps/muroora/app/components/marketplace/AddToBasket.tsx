'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * Add to basket, on the marketplace product page.
 *
 * TWO SEPARATE BUGS MET HERE, AND BOTH WERE MINE OR OLDER.
 *
 * 1. The button was a `<Link href={'/cart?add=' + id}>`. That URL contract does
 *    not exist: /cart ignores its query string entirely, so pressing the button
 *    navigated to the basket and added nothing. It looked like the cart was
 *    silently dropping items.
 *
 * 2. Underneath that, `addToCart` filtered on a single hard-coded STORE_ID, so
 *    even a correct request for another merchant's product came back "No such
 *    product". Every merchant except the founding one was browse-only and
 *    nothing on the site said so. Fixed in lib/services/cart.ts.
 *
 * The real contract is `POST /api/cart` with `{ productId, quantity }`, which
 * mints the guest cookie on first use, so no account is needed to fill a
 * basket.
 *
 * WHY THE ERROR IS SHOWN RATHER THAN SWALLOWED
 *
 * The cart refuses for reasons a customer can act on: out of stock, only two
 * left, or a basket that already holds another shop's goods. Those sentences
 * are written to be read by the person holding the phone, so they are put on
 * the screen instead of into a console nobody opens.
 */
export function AddToBasket({
  productId,
  merchantName,
}: {
  productId: string
  merchantName: string
}) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'adding' | 'added'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function add() {
    setState('adding')
    setError(null)
    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: 1 }),
      })
      const body = (await response.json()) as
        | { data: unknown }
        | { error: { message: string } }

      if (!response.ok || 'error' in body) {
        setError(
          'error' in body
            ? body.error.message
            : 'That could not be added just now.',
        )
        setState('idle')
        return
      }

      setState('added')
      // The basket count lives in a server component, so it only changes when
      // the route refreshes. Without this the header keeps showing the old
      // number and the customer reasonably concludes nothing happened.
      router.refresh()

      /* The analytics event is fire and forget. See ShareProduct for why. */
      void fetch('/api/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'ADD_TO_CART',
          productId,
          surface: 'STOREFRONT',
        }),
        keepalive: true,
      }).catch(() => {})
    } catch {
      setError('No connection. Try again in a moment.')
      setState('idle')
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={state === 'adding'}
          onClick={() => void add()}
          className="inline-flex min-h-12 items-center rounded-full bg-accent px-8 py-3 font-bold text-white transition-colors hover:bg-accent-deep disabled:opacity-60"
        >
          {state === 'adding'
            ? 'Adding…'
            : state === 'added'
              ? 'Added to basket'
              : 'Add to basket'}
        </button>

        {state === 'added' && (
          <a
            href="/cart"
            className="inline-flex min-h-12 items-center rounded-full border border-support px-6 py-3 font-bold text-support"
          >
            View basket
          </a>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 max-w-prose text-small text-[#a02015]">
          {error}
        </p>
      )}

      <p className="mt-3 text-small text-ink-faint">
        Sold and prepared by {merchantName}. Musuwo handles the delivery.
      </p>
    </div>
  )
}
