'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import type { ApiEnvelope, CartData } from './types'

export function CartLink() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let active = true

    fetch('/api/cart')
      .then((response) => response.json())
      .then((payload: ApiEnvelope<CartData>) => {
        if (active && 'data' in payload) setCount(payload.data.itemCount)
      })
      .catch(() => undefined)

    const update = (event: Event) => {
      const cartEvent = event as CustomEvent<CartData>
      setCount(cartEvent.detail.itemCount)
    }
    window.addEventListener('muroora:cart', update)

    return () => {
      active = false
      window.removeEventListener('muroora:cart', update)
    }
  }, [])

  return (
    <Link
      href="/cart"
      aria-label={`Cart with ${count} ${count === 1 ? 'item' : 'items'}`}
      className="relative inline-flex min-h-11 items-center gap-2 px-2 font-mono text-micro font-bold uppercase tracking-label text-ink-soft transition-colors hover:text-accent"
    >
      <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.2 10.2a2 2 0 0 0 2 1.6h7.9a2 2 0 0 0 1.9-1.4L21 8H7" />
        <circle cx="10" cy="20" r="1.2" fill="currentColor" stroke="none" />
        <circle cx="18" cy="20" r="1.2" fill="currentColor" stroke="none" />
      </svg>
      <span className="hidden lg:inline">Cart</span>
      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[0.64rem] leading-none text-white">
        {count}
      </span>
    </Link>
  )
}
