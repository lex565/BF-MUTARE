'use client'

import { useState } from 'react'

import type { ApiEnvelope, CartData } from './types'

interface AddToCartButtonProps {
  productId: string
  disabled?: boolean
  compact?: boolean
}

export function AddToCartButton({
  productId,
  disabled = false,
  compact = false,
}: AddToCartButtonProps) {
  const [state, setState] = useState<'idle' | 'adding' | 'added' | 'error'>('idle')
  const [message, setMessage] = useState('')

  async function add() {
    setState('adding')
    setMessage('')

    try {
      const response = await fetch('/api/cart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity: 1 }),
      })
      const payload = (await response.json()) as ApiEnvelope<CartData>

      if (!response.ok || 'error' in payload) {
        throw new Error('error' in payload ? payload.error.message : 'Could not add that item.')
      }

      setState('added')
      setMessage('Added to cart')
      window.dispatchEvent(
        new CustomEvent('muroora:cart', { detail: payload.data }),
      )
      window.setTimeout(() => setState('idle'), 1800)
    } catch (error) {
      setState('error')
      setMessage(error instanceof Error ? error.message : 'Could not add that item.')
    }
  }

  const label =
    state === 'adding' ? 'Adding…' : state === 'added' ? 'Added ✓' : 'Add to cart'

  return (
    <div className={compact ? '' : 'w-full'}>
      <button
        type="button"
        onClick={add}
        disabled={disabled || state === 'adding'}
        className={`inline-flex min-h-11 items-center justify-center bg-accent font-mono text-micro font-bold uppercase tracking-label text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:bg-rule disabled:text-ink-faint ${
          compact ? 'w-full px-4 py-3' : 'w-full px-6 py-4'
        }`}
      >
        {disabled ? 'Out of stock' : label}
      </button>
      {message && state === 'error' && (
        <p className="mt-2 text-small text-red-700" role="alert">
          {message}
        </p>
      )}
      {message && state === 'added' && (
        <span className="sr-only" role="status">
          {message}
        </span>
      )}
    </div>
  )
}
