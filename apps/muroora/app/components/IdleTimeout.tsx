'use client'

import { useEffect, useRef, useState } from 'react'

import { signOutIdle } from '@/app/login/actions'

/**
 * Sign out after 30 minutes of no activity.
 *
 * A shop tablet on the counter, or an office machine somebody walks away from,
 * is the realistic threat here: not an attacker, just a screen left open in a
 * room other people can reach. The session has admin rights on it.
 *
 * WHY THIS IS NOT THE WHOLE ANSWER: a timer in the browser is only a
 * convenience. Anybody who wants to defeat it can stop the script. The real
 * limit is the Supabase session lifetime, which the server enforces. This
 * closes the ordinary case, which is the case that actually happens.
 *
 * A warning appears at 28 minutes so nobody loses half-typed work without
 * notice, and any movement at all takes it away again.
 */

const IDLE_MS = 30 * 60 * 1000
const WARN_MS = 28 * 60 * 1000

/** Activity that counts. Deliberately broad: reading is activity too. */
const EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'wheel',
  'focus',
] as const

export function IdleTimeout() {
  const [warning, setWarning] = useState(false)
  const lastActive = useRef(0)
  const warned = useRef(false)

  useEffect(() => {
    let stopped = false
    // Seeded here, not at render: Date.now() during render is impure and
    // would differ between the server pass and the client one.
    lastActive.current = Date.now()

    const markActive = () => {
      lastActive.current = Date.now()
      if (warned.current) {
        warned.current = false
        setWarning(false)
      }
    }

    // Throttled: mousemove fires constantly and this only needs a timestamp.
    let throttle = 0
    const onActivity = () => {
      const now = Date.now()
      if (now - throttle < 1000) return
      throttle = now
      markActive()
    }

    for (const event of EVENTS) {
      window.addEventListener(event, onActivity, { passive: true })
    }

    // Activity in one tab counts for all of them. Without this, somebody
    // working in a second tab gets signed out by the first one sitting idle.
    const channel =
      typeof BroadcastChannel !== 'undefined'
        ? new BroadcastChannel('muroora-activity')
        : null
    channel?.addEventListener('message', markActive)

    const relay = setInterval(() => {
      if (Date.now() - lastActive.current < 5000) channel?.postMessage('active')
    }, 5000)

    const tick = setInterval(() => {
      if (stopped) return
      const idle = Date.now() - lastActive.current

      if (idle >= IDLE_MS) {
        stopped = true
        void signOutIdle()
        return
      }
      if (idle >= WARN_MS && !warned.current) {
        warned.current = true
        setWarning(true)
      }
    }, 15000)

    return () => {
      stopped = true
      clearInterval(tick)
      clearInterval(relay)
      for (const event of EVENTS) {
        window.removeEventListener(event, onActivity)
      }
      channel?.removeEventListener('message', markActive)
      channel?.close()
    }
  }, [])

  if (!warning) return null

  return (
    <div
      role="alert"
      className="fixed bottom-4 left-1/2 z-[200] w-[min(92vw,26rem)] -translate-x-1/2 border-2 border-accent bg-paper p-5 shadow-lg"
    >
      <p className="font-bold">Still there?</p>
      <p className="mt-2 text-small text-ink-soft">
        You will be signed out in about two minutes because nothing has
        happened for a while. Move the mouse or touch the screen to stay in.
      </p>
    </div>
  )
}
