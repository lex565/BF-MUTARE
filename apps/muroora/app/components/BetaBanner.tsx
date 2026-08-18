'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'

const KEY = 'musuwo.beta-banner.dismissed'

/**
 * A quiet line inviting people to test the app.
 *
 * DISMISSIBLE, AND IT STAYS DISMISSED. Kept in localStorage rather than a
 * cookie: it is a display preference, it never needs to leave the browser, and
 * sending it to the server on every request would be wasted bytes on
 * connections where bytes are not free.
 *
 * READ THROUGH useSyncExternalStore, not an effect. The obvious version - set
 * state inside useEffect - is what React's own lint rule warns about, and the
 * reason is visible on screen: the component renders, the effect runs, the
 * banner appears and then vanishes for anybody who dismissed it last week.
 * That flicker is why most dismissible banners feel broken.
 *
 * The server snapshot says "dismissed", so the markup sent down contains no
 * banner and there is nothing to flash. A first-time visitor gets it on the
 * client's first read instead.
 */
const listeners = new Set<() => void>()

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  // Another tab dismissing it should settle this one too.
  window.addEventListener('storage', onChange)
  return () => {
    listeners.delete(onChange)
    window.removeEventListener('storage', onChange)
  }
}

function isDismissed(): boolean {
  try {
    return window.localStorage.getItem(KEY) === '1'
  } catch {
    // Private browsing can refuse localStorage entirely. Showing the banner is
    // the right failure - it is useful, and dismissing simply will not stick.
    return false
  }
}

/** Server render: treat it as dismissed so no banner is in the HTML to flash. */
const dismissedOnServer = () => true

function dismiss() {
  try {
    window.localStorage.setItem(KEY, '1')
  } catch {
    /* nothing to do - it just will not persist */
  }
  for (const l of listeners) l()
}

export function BetaBanner() {
  const pathname = usePathname()
  const hidden = useSyncExternalStore(subscribe, isDismissed, dismissedOnServer)

  if (hidden) return null
  // Inviting somebody to a page they are already reading is the kind of detail
  // that makes software feel unattended.
  if (pathname?.startsWith('/beta')) return null
  if (pathname?.startsWith('/super-admin')) return null

  return (
    <div className="border-b border-rule bg-support text-white">
      <div className="mx-auto flex max-w-[86rem] flex-wrap items-center gap-x-4 gap-y-2 px-gutter py-2.5">
        <span className="font-mono text-micro font-bold uppercase tracking-label text-[#ffb37a]">
          Beta
        </span>
        <p className="text-small">
          The Musuwo Android app is in testing.{' '}
          <Link href="/beta" className="font-bold underline underline-offset-2">
            Try it and tell us what breaks
          </Link>
          .
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide this"
          className="ml-auto rounded-sm px-2 py-1 font-mono text-micro uppercase tracking-label text-white/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffb37a]"
        >
          Hide
        </button>
      </div>
    </div>
  )
}
