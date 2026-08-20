'use client'

import { useCallback, useState } from 'react'

/**
 * Sharing a product, as a link to Musuwo rather than a message to a merchant.
 *
 * WHAT THIS REPLACED
 *
 * The product page had two WhatsApp buttons and nothing else. "Share on
 * WhatsApp" sent this text:
 *
 *   Cotton pants from The Pant and Perfume Shop on Musuwo:
 *   /marketplace/product/the-pant-and-perfume-shop/cotton-pants
 *
 * A bare path with no host. The recipient got unclickable text and no route
 * back to the product, so every share was a dead end. That is the bug this
 * component exists to fix, and it is why `url` is required to be absolute.
 *
 * WHY WEB SHARE FIRST
 *
 * `navigator.share` opens the phone's own sheet, so somebody can send the link
 * through WhatsApp, Messenger, SMS or anything else they actually have
 * installed - which on a Zimbabwean phone is not always WhatsApp. It is only
 * available over HTTPS and mostly on mobile, so the WhatsApp button and Copy
 * link stay as the fallback rather than being replaced by it.
 *
 * WHY THE ANALYTICS CALL IS FIRE AND FORGET
 *
 * The share must happen whether or not the event records. `void fetch` with no
 * await means a slow connection never delays the share sheet opening, and a
 * failed request never surfaces an error to somebody who just wanted to send
 * their sister a link.
 *
 * Only the channel is recorded. Never who it was sent to - the platform does
 * not learn that and has no business asking.
 */

type Channel = 'native' | 'whatsapp' | 'copy'

export function ShareProduct({
  productId,
  name,
  price,
  merchantName,
  url,
}: {
  productId: string
  name: string
  price: string
  merchantName: string
  /** Absolute. See the note above about what a relative one did. */
  url: string
}) {
  const [copied, setCopied] = useState(false)
  const [canCopy] = useState(
    () => typeof navigator !== 'undefined' && Boolean(navigator.clipboard),
  )

  const message = `${name} - $${price}\n${merchantName}\nAvailable on Musuwo\n\n${url}`

  const record = useCallback(
    (channel: Channel) => {
      void fetch('/api/discovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'PRODUCT_SHARED',
          productId,
          surface: 'STOREFRONT',
          shareChannel: channel,
        }),
        keepalive: true,
      }).catch(() => {})
    },
    [productId],
  )

  const shareNative = useCallback(async () => {
    record('native')
    try {
      await navigator.share({ title: `${name} on Musuwo`, text: message, url })
    } catch {
      /* The person closed the sheet. Not an error. */
    }
  }, [message, name, record, url])

  const copy = useCallback(async () => {
    record('copy')
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      /* Clipboard refused. The WhatsApp button still works. */
    }
  }, [record, url])

  const hasNative =
    typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  return (
    <div className="flex flex-wrap items-center gap-3">
      {hasNative && (
        <button
          type="button"
          onClick={() => void shareNative()}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-support px-6 py-3 font-bold text-white"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            className="size-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 3v13M12 3 8 7M12 3l4 4M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
          </svg>
          Share
        </button>
      )}

      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noreferrer"
        onClick={() => record('whatsapp')}
        className="inline-flex min-h-11 items-center rounded-full border border-[#128c7e] px-6 py-3 font-bold text-[#128c7e]"
      >
        WhatsApp
      </a>

      {canCopy && (
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex min-h-11 items-center rounded-full border border-rule px-6 py-3 font-bold text-support"
        >
          {copied ? 'Link copied' : 'Copy link'}
        </button>
      )}

      <span role="status" aria-live="polite" className="sr-only">
        {copied ? 'Product link copied to the clipboard.' : ''}
      </span>
    </div>
  )
}
