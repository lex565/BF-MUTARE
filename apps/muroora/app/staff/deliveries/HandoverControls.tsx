'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import { cancelHandoverAction, startHandoverAction, type HandoverState } from './actions'

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className="border border-ink bg-ink px-4 py-2 font-mono text-micro uppercase tracking-label text-paper disabled:opacity-50">{pending ? 'Working...' : children}</button>
}

const Result = ({ state }: { state: HandoverState }) => state.error
  ? <p role="alert" className="text-small text-accent">{state.error}</p>
  : state.message ? <p role="status" className="text-small text-support">{state.message}</p> : null

export function HandoverControls({ deliveryId, started }: { deliveryId: string; started: boolean }) {
  const [startState, startAction] = useActionState(startHandoverAction, {})
  const [cancelState, cancelAction] = useActionState(cancelHandoverAction, {})
  if (started) return <form action={cancelAction} className="space-y-2"><input type="hidden" name="deliveryId" value={deliveryId} /><input name="reason" required placeholder="Why is handover cancelled?" className="w-full border border-rule bg-paper px-3 py-2 text-small" /><Submit>Cancel handover</Submit><Result state={cancelState} /><p className="text-small text-ink-soft">The rider must confirm collection in their app before custody and exposure change.</p></form>
  return <form action={startAction} className="space-y-2"><input type="hidden" name="deliveryId" value={deliveryId} /><Submit>Package checked · start handover</Submit><Result state={startState} /></form>
}
