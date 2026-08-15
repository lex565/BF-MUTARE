'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'

import { moneyLabel, type ApiEnvelope, type CartData } from './types'

const emptyCart: CartData = {
  id: '',
  itemCount: 0,
  subtotal: { amount: '0', currency: 'USD', decimal: '0.00' },
  hasProblems: false,
  lines: [],
}

export function CartView() {
  const [cart, setCart] = useState<CartData>(emptyCart)
  const [loading, setLoading] = useState(true)
  const [changing, setChanging] = useState<string | null>(null)
  const [error, setError] = useState('')

  const publish = useCallback((next: CartData) => {
    setCart(next)
    window.dispatchEvent(new CustomEvent('muroora:cart', { detail: next }))
  }, [])

  async function reload() {
    setLoading(true)
    setError('')
    try {
      const response = await fetch('/api/cart', { cache: 'no-store' })
      const payload = (await response.json()) as ApiEnvelope<CartData>
      if (!response.ok || 'error' in payload) {
        throw new Error('error' in payload ? payload.error.message : 'Could not load your cart.')
      }
      publish(payload.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load your cart.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    fetch('/api/cart', { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json()) as ApiEnvelope<CartData>
        if (!response.ok || 'error' in payload) {
          throw new Error(
            'error' in payload ? payload.error.message : 'Could not load your cart.',
          )
        }
        if (active) publish(payload.data)
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : 'Could not load your cart.')
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [publish])

  async function setQuantity(productId: string, quantity: number) {
    setChanging(productId)
    setError('')
    try {
      const response = await fetch('/api/cart', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
      })
      const payload = (await response.json()) as ApiEnvelope<CartData>
      if (!response.ok || 'error' in payload) {
        throw new Error('error' in payload ? payload.error.message : 'Could not update your cart.')
      }
      publish(payload.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update your cart.')
    } finally {
      setChanging(null)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4" aria-label="Loading your cart" aria-busy="true">
        {[1, 2].map((item) => (
          <div key={item} className="h-32 animate-pulse bg-paper-sunk" />
        ))}
      </div>
    )
  }

  if (error && cart.lines.length === 0) {
    return (
      <div className="border border-red-300 bg-red-50 p-8">
        <p className="text-h3 font-bold">Your cart could not be loaded</p>
        <p className="mt-3 text-ink-soft">{error}</p>
        <button
          type="button"
          onClick={() => void reload()}
          className="mt-6 bg-ink px-6 py-3 font-mono text-micro uppercase tracking-label text-paper"
        >
          Try again
        </button>
      </div>
    )
  }

  if (cart.lines.length === 0) {
    return (
      <div className="border border-rule bg-paper-sunk px-6 py-16 text-center">
        <span aria-hidden className="text-5xl">🛒</span>
        <h2 className="mt-5 text-h2">Your cart is ready when you are</h2>
        <p className="mx-auto mt-3 max-w-md text-ink-soft">
          Browse real Muroora stock and add the things your household—or someone
          back home—needs.
        </p>
        <Link
          href="/shop"
          className="mt-7 inline-flex bg-accent px-7 py-4 font-mono text-micro font-bold uppercase tracking-label text-white hover:bg-accent-deep"
        >
          Start shopping
        </Link>
      </div>
    )
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <section aria-label="Cart items">
        {error && (
          <p className="mb-5 border border-red-300 bg-red-50 p-4 text-small text-red-800" role="alert">
            {error}
          </p>
        )}
        {cart.hasProblems && (
          <div className="mb-5 border border-orange-300 bg-orange-50 p-5">
            <p className="font-bold">One or more quantities need attention</p>
            <p className="mt-1 text-small text-ink-soft">
              Adjust the highlighted item before continuing to checkout.
            </p>
          </div>
        )}

        <ul className="divide-y divide-rule border-y border-rule">
          {cart.lines.map((line) => {
            const busy = changing === line.productId
            return (
              <li key={line.itemId} className="grid gap-5 py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                <div>
                  <Link href={`/product/${line.slug}`} className="text-h4 font-bold hover:text-support">
                    {line.name}
                  </Link>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-small text-ink-faint">
                    {line.unitSize && <span>{line.unitSize}</span>}
                    <span>{moneyLabel(line.unitPrice)} each</span>
                  </div>
                  {line.exceedsStock && (
                    <p className="mt-3 text-small font-bold text-accent-deep" role="alert">
                      Only {line.sellable} can currently be supplied.
                    </p>
                  )}
                </div>

                <div className="flex items-center justify-between gap-5 sm:justify-end">
                  <div className="inline-flex min-h-11 items-center border border-rule" aria-label={`Quantity for ${line.name}`}>
                    <button
                      type="button"
                      onClick={() => void setQuantity(line.productId, line.quantity - 1)}
                      disabled={busy}
                      className="min-h-11 min-w-11 text-xl hover:bg-paper-sunk disabled:opacity-50"
                      aria-label={`Remove one ${line.name}`}
                    >
                      −
                    </button>
                    <span className="min-w-10 text-center font-mono text-small" aria-live="polite">
                      {busy ? '…' : line.quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => void setQuantity(line.productId, line.quantity + 1)}
                      disabled={busy || line.quantity >= line.sellable}
                      className="min-h-11 min-w-11 text-xl hover:bg-paper-sunk disabled:opacity-40"
                      aria-label={`Add one ${line.name}`}
                    >
                      +
                    </button>
                  </div>
                  <p className="min-w-24 text-right font-display text-h4 font-extrabold">
                    {moneyLabel(line.lineTotal)}
                  </p>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <aside className="border border-rule bg-paper-sunk p-6 lg:sticky lg:top-28">
        <p className="font-mono text-micro uppercase tracking-label text-accent">Order summary</p>
        <dl className="mt-6 space-y-4">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Items ({cart.itemCount})</dt>
            <dd className="font-bold">{moneyLabel(cart.subtotal)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-soft">Delivery</dt>
            <dd className="text-right text-small text-ink-faint">Calculated from the recipient’s suburb</dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-rule pt-5 text-h4 font-extrabold">
            <dt>Subtotal</dt>
            <dd>{moneyLabel(cart.subtotal)}</dd>
          </div>
        </dl>

        {cart.hasProblems ? (
          <button disabled className="mt-7 w-full bg-rule px-6 py-4 font-mono text-micro uppercase tracking-label text-ink-faint">
            Fix cart to continue
          </button>
        ) : (
          <Link
            href="/checkout"
            className="mt-7 flex min-h-12 w-full items-center justify-center bg-accent px-6 py-4 text-center font-mono text-micro font-bold uppercase tracking-label text-white hover:bg-accent-deep"
          >
            Proceed to checkout
          </Link>
        )}
        <Link href="/shop" className="mt-4 block text-center font-mono text-micro uppercase tracking-label text-support hover:text-accent">
          Continue shopping
        </Link>
      </aside>
    </div>
  )
}
