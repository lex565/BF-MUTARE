'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import { ProductPhoto } from '@/app/components/marketplace/ProductPhoto'
import type { MarketplaceProduct } from '@/lib/services/marketplace'

/**
 * For You: the product feed, its impression tracking, and getting people back
 * to where they were.
 *
 * WHAT MAKES AN IMPRESSION HERE
 *
 * Section 14 is specific: an impression is the card being meaningfully visible,
 * not the card existing. So it is an IntersectionObserver at 50% visibility
 * with a 600ms dwell, and a card that flashes past during a fast scroll never
 * fires. A `reported` ref holds every id already sent for the life of the
 * page, so a rerender cannot re-report - React will re-run effects, and the
 * server-side deduplication would catch it anyway, but making the client
 * correct too means the server's protection is a backstop rather than the only
 * thing standing between us and inflated numbers.
 *
 * Reports are batched and flushed on a timer. Twenty-four separate requests to
 * say "the screen scrolled" is not a reasonable thing to charge a shopper in
 * Mutare for.
 *
 * RETURNING TO THE SAME PLACE, WHICH IS THE HARD PART
 *
 * Section 10 asks that opening a product and coming back returns you to your
 * position, not the top. Next's App Router restores scroll on back/forward for
 * a cached page, but this feed is server-rendered per request, so the
 * restoration has to be explicit.
 *
 * The position is written to sessionStorage - not localStorage, which would
 * still be there next week and drop somebody halfway down a feed they have
 * never seen. It is keyed by the feed's identity so the Food tab and the
 * Everything tab do not restore each other's positions. And it is only applied
 * when the page was actually reached by going back: `performance.navigation`
 * type via the modern entries API. Restoring on a fresh visit would be a bug
 * that looks like a broken homepage.
 */

type Props = {
  products: MarketplaceProduct[]
  /** Distinguishes one feed from another for scroll restoration. */
  feedKey: string
  surface?: 'FOR_YOU' | 'SEARCH' | 'CATEGORY'
}

const FLUSH_MS = 1200
const DWELL_MS = 600
const VISIBLE_FRACTION = 0.5

export function ForYouFeed({ products, feedKey, surface = 'FOR_YOU' }: Props) {
  const reported = useRef<Set<string>>(new Set())
  const pending = useRef<Set<string>>(new Set())
  const timers = useRef<Map<string, number>>(new Map())
  const flushTimer = useRef<number | null>(null)
  const [restored, setRestored] = useState(false)

  /* ------------------------------------------------------------ reporting */

  const flush = useCallback(() => {
    flushTimer.current = null
    if (pending.current.size === 0) return
    const batch = [...pending.current]
    pending.current.clear()

    // keepalive so a flush that lands as the customer taps into a product is
    // still delivered rather than cancelled by the navigation.
    void fetch('/api/discovery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ impressions: batch, surface }),
      keepalive: true,
    }).catch(() => {
      /* Analytics must never surface an error to a shopper. */
    })
  }, [surface])

  const queue = useCallback(
    (productId: string) => {
      if (reported.current.has(productId)) return
      reported.current.add(productId)
      pending.current.add(productId)
      if (flushTimer.current === null) {
        flushTimer.current = window.setTimeout(flush, FLUSH_MS)
      }
    },
    [flush],
  )

  useEffect(() => {
    const dwell = timers.current
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.productId
          if (!id) continue

          if (entry.isIntersecting) {
            if (dwell.has(id) || reported.current.has(id)) continue
            dwell.set(
              id,
              window.setTimeout(() => {
                dwell.delete(id)
                queue(id)
              }, DWELL_MS),
            )
          } else {
            const timer = dwell.get(id)
            if (timer !== undefined) {
              window.clearTimeout(timer)
              dwell.delete(id)
            }
          }
        }
      },
      { threshold: VISIBLE_FRACTION },
    )

    document
      .querySelectorAll('[data-product-id]')
      .forEach((node) => observer.observe(node))

    // A tab switched away is not a tab being looked at, and a phone locked
    // mid-feed should not accrue exposure. Flush what is real and stop.
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    document.addEventListener('visibilitychange', onHide)

    return () => {
      observer.disconnect()
      document.removeEventListener('visibilitychange', onHide)
      dwell.forEach((timer) => window.clearTimeout(timer))
      dwell.clear()
      if (flushTimer.current !== null) window.clearTimeout(flushTimer.current)
      flush()
    }
  }, [flush, queue, products])

  /* --------------------------------------------------- scroll restoration */

  const storageKey = `musuwo:feed:${feedKey}`

  useEffect(() => {
    const entries = performance.getEntriesByType('navigation')
    const nav = entries[0] as PerformanceNavigationTiming | undefined
    const cameBack = nav?.type === 'back_forward'

    const saved = sessionStorage.getItem(storageKey)
    if (cameBack && saved) {
      const y = Number(saved)
      if (Number.isFinite(y) && y > 0) {
        // Two frames: one for the layout to settle, one for images that have
        // reserved their space via the aspect-ratio box to stop shifting it.
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior })
            setRestored(true)
          }),
        )
      }
    } else if (!cameBack) {
      // A fresh arrival starts at the top and forgets the old position, so a
      // stale offset cannot ambush somebody later.
      sessionStorage.removeItem(storageKey)
    }

    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        sessionStorage.setItem(storageKey, String(window.scrollY))
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [storageKey])

  /* ------------------------------------------------------------- rendering */

  if (products.length === 0) {
    return (
      <div className="border border-rule bg-paper p-8 md:p-12">
        <p className="font-mono text-micro font-bold uppercase tracking-[0.3em] text-accent">
          For you
        </p>
        <h2 className="mt-4 text-h1 text-support">Nothing to show yet.</h2>
        <p className="mt-4 max-w-xl text-ink-soft">
          Products appear here once an approved business publishes them. Nothing
          on Musuwo is invented to fill the page.
        </p>
        <Link
          href="/marketplace"
          className="mt-7 inline-flex border border-support px-6 py-3 font-bold text-support"
        >
          See the businesses
        </Link>
      </div>
    )
  }

  return (
    <>
      {restored && (
        <p role="status" className="sr-only">
          Returned to where you were in the feed.
        </p>
      )}
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {products.map((product) => (
          <article key={product.id} data-product-id={product.id}>
            <Link
              /* Into the merchant's shop, carrying the product. Section 5:
                 the customer must land understanding whose shop they are in. */
              href={`/marketplace/product/${product.merchant.slug}/${product.slug}`}
              className="group flex h-full flex-col border border-rule bg-paper transition-colors hover:border-support"
            >
              <ProductPhoto src={product.imageUrl} alt={product.name} />
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-body font-bold leading-snug group-hover:text-support">
                  {product.name}
                </h3>
                {product.unitSize && (
                  <p className="mt-1 text-small text-ink-faint">{product.unitSize}</p>
                )}
                <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-ink-soft">
                  <span>{product.merchant.name}</span>
                  {product.merchant.verified && (
                    <span
                      title="Musuwo has seen this business's trading licence. It says the business is registered, not that it is good."
                      className="rounded-pill bg-support/10 px-2 py-0.5 font-mono text-micro font-bold uppercase tracking-label text-support"
                    >
                      Verified
                    </span>
                  )}
                </p>
                <p className="mt-auto pt-4 text-h3 text-support">
                  ${product.price.decimal}
                </p>
              </div>
            </Link>
          </article>
        ))}
      </div>
    </>
  )
}
