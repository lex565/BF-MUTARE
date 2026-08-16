'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  assignDeliveryAction,
  changeRiderStatusAction,
  completeDeliveryExceptionAction,
  createDeliveryAction,
  createTrustLevelAction,
  reconcileReturnAction,
  reviewIncidentAction,
  setRiderTrustAction,
  updateRiderNotesAction,
  type RiderFormState,
} from './actions'

const field = 'w-full border border-rule bg-paper px-3 py-2 text-small focus:border-accent focus:outline-none'

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus()
  return <button type="submit" disabled={pending} className="border border-ink bg-ink px-4 py-2 font-mono text-micro uppercase tracking-label text-paper disabled:opacity-50">{pending ? 'Working...' : children}</button>
}

function Result({ state }: { state: RiderFormState }) {
  if (state.error) return <p role="alert" className="text-small text-accent">{state.error}</p>
  if (state.message) return <p role="status" className="text-small text-support">{state.message}</p>
  return null
}

export function TrustLevelForm() {
  const [state, action] = useActionState(createTrustLevelAction, {})
  return <form action={action} className="mt-6 grid max-w-3xl gap-3 sm:grid-cols-2">
    <input className={field} name="level" inputMode="numeric" placeholder="Level (1-4)" required />
    <input className={field} name="name" placeholder="Name" required />
    <input className={field} name="maximumExposure" inputMode="decimal" placeholder="Maximum exposure, e.g. 25.00" required />
    <select className={field} name="currency" defaultValue="USD"><option>USD</option><option>ZWL</option></select>
    <input className={`${field} sm:col-span-2`} name="description" placeholder="Description (optional)" />
    <div className="flex items-center gap-4 sm:col-span-2"><Submit>Add level</Submit><Result state={state} /></div>
  </form>
}

export function RiderManagementForms({ rider, levels }: { rider: { id: string; currency: 'USD' | 'ZWL'; internalNotes: string | null; accountStatus: string; verificationStatus: string; trustLevelId: string | null }; levels: { id: string; level: number; name: string }[] }) {
  const [statusState, statusAction] = useActionState(changeRiderStatusAction, {})
  const [trustState, trustAction] = useActionState(setRiderTrustAction, {})
  const [notesState, notesAction] = useActionState(updateRiderNotesAction, {})
  return <div className="mt-6 grid gap-8 lg:grid-cols-3">
    <form action={statusAction} className="space-y-3 border border-rule p-5">
      <h3 className="font-bold">Status and access</h3><input type="hidden" name="riderId" value={rider.id} />
      <select className={field} name="status" defaultValue={rider.accountStatus}>{['UNDER_REVIEW','VERIFICATION_COMPLETE','CONTRACT_CONFIRMED','APPROVED','ACTIVE','REJECTED','RESTRICTED','SUSPENDED','INACTIVE'].map(x => <option key={x}>{x}</option>)}</select>
      <select className={field} name="verificationStatus" defaultValue={rider.verificationStatus}>{['NOT_STARTED','IN_PROGRESS','VERIFIED','NEEDS_INFORMATION','EXPIRED'].map(x => <option key={x}>{x}</option>)}</select>
      <textarea className={field} name="reason" placeholder="Required decision reason" required /><Submit>Save status</Submit><Result state={statusState} />
    </form>
    <form action={trustAction} className="space-y-3 border border-rule p-5">
      <h3 className="font-bold">Trust and exposure</h3><input type="hidden" name="riderId" value={rider.id} /><input type="hidden" name="currency" value={rider.currency} />
      <select className={field} name="trustLevelId" defaultValue={rider.trustLevelId ?? ''} required><option value="" disabled>Select trust level</option>{levels.map(x => <option key={x.id} value={x.id}>Level {x.level} - {x.name}</option>)}</select>
      <input className={field} name="exposureOverride" inputMode="decimal" placeholder="Personal limit override (optional)" />
      <textarea className={field} name="reason" placeholder="Required change reason" required /><Submit>Save trust</Submit><Result state={trustState} />
    </form>
    <form action={notesAction} className="space-y-3 border border-rule p-5">
      <h3 className="font-bold">Internal notes</h3><input type="hidden" name="riderId" value={rider.id} />
      <textarea className={`${field} min-h-32`} name="notes" defaultValue={rider.internalNotes ?? ''} /><Submit>Save notes</Submit><Result state={notesState} />
    </form>
  </div>
}

export function CreateDeliveryForm({ orderId, currency }: { orderId: string; currency: 'USD' | 'ZWL' }) {
  const [state, action] = useActionState(createDeliveryAction, {})
  return <form action={action} className="flex min-w-80 flex-wrap items-center gap-2"><input type="hidden" name="orderId" value={orderId} /><input type="hidden" name="currency" value={currency} /><input className={field} name="earning" inputMode="decimal" placeholder="Rider earning (optional)" /><select className={field} name="requiredVehicleType" defaultValue=""><option value="">Any vehicle</option><option>BICYCLE</option><option>MOTORBIKE</option><option>CAR</option></select><Submit>Create delivery</Submit><Result state={state} /></form>
}

export function AssignDeliveryForm({ deliveryId, riders }: { deliveryId: string; riders: { id: string; publicRiderId: string; displayName: string }[] }) {
  const [state, action] = useActionState(assignDeliveryAction, {})
  return <form action={action} className="min-w-80 space-y-2"><input type="hidden" name="deliveryId" value={deliveryId} /><select className={field} name="riderId" required><option value="">Choose available rider</option>{riders.map(r => <option key={r.id} value={r.id}>{r.publicRiderId} - {r.displayName}</option>)}</select><input className={field} name="overrideReason" placeholder="Override reason only if exposure is blocked" /><Submit>Offer delivery</Submit><Result state={state} /></form>
}

export function DeliveryResolutionForm({ deliveryId, riderId }: { deliveryId: string; riderId: string }) {
  const [exceptionState, exceptionAction] = useActionState(completeDeliveryExceptionAction, {})
  const [returnState, returnAction] = useActionState(reconcileReturnAction, {})
  return <div className="grid gap-3 md:grid-cols-2">{[[exceptionAction, exceptionState, 'Authorized proof exception'], [returnAction, returnState, 'Confirm goods returned']] .map(([action, state, label]) => <form key={label as string} action={action as (payload: FormData) => void} className="space-y-2 border border-rule p-4"><input type="hidden" name="deliveryId" value={deliveryId} /><input type="hidden" name="riderId" value={riderId} /><textarea className={field} name="reason" placeholder="Detailed reason (required)" required /><Submit>{label as string}</Submit><Result state={state as RiderFormState} /></form>)}</div>
}

export function IncidentReviewForm({ incidentId, riderId }: { incidentId: string; riderId: string }) {
  const [state, action] = useActionState(reviewIncidentAction, {})
  return <form action={action} className="mt-3 flex flex-wrap gap-2"><input type="hidden" name="incidentId" value={incidentId} /><input type="hidden" name="riderId" value={riderId} /><select className={field} name="status"><option>UNDER_REVIEW</option><option>RESOLVED</option><option>CLOSED</option></select><input className={field} name="resolutionNote" placeholder="Review decision" required /><Submit>Save review</Submit><Result state={state} /></form>
}
