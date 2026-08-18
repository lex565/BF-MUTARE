'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  approveAction,
  claimAction,
  noteAction,
  rejectAction,
  releaseAction,
  requestInfoAction,
  type ReviewState,
} from '@/app/super-admin/applications/actions'

/**
 * The decision panel.
 *
 * Only the actions this reviewer may actually take are drawn. That is a
 * courtesy, not a control: the server checks again inside every one of these
 * actions, because a hidden button is still a live endpoint to anybody who can
 * sign in and send a request.
 *
 * Approve and Reject both require a second click to confirm. Not a modal - a
 * modal is dismissed by reflex - but the button changing into a question that
 * has to be answered. Both create something that cannot be quietly undone: an
 * approval makes a public business with an owner, and a rejection is read by a
 * real person who was hoping for the opposite.
 */

function Submit({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? 'Working…' : label}
    </button>
  )
}

function Feedback({ state }: { state: ReviewState }) {
  if (state.error) {
    return (
      <p className="cc-note cc-error" role="alert">
        {state.error}
      </p>
    )
  }
  if (state.message) {
    return (
      <p className="cc-note" role="status">
        {state.message}
      </p>
    )
  }
  return null
}

export function ReviewPanel({
  id,
  status,
  assignedToMe,
  assignedToName,
  can,
}: {
  id: string
  status: string
  assignedToMe: boolean
  assignedToName: string | null
  can: { review: boolean; approve: boolean; reject: boolean }
}) {
  const [claimState, claim] = useActionState<ReviewState, FormData>(claimAction, {})
  const [releaseState, release] = useActionState<ReviewState, FormData>(releaseAction, {})
  const [noteState, note] = useActionState<ReviewState, FormData>(noteAction, {})
  const [infoState, info] = useActionState<ReviewState, FormData>(requestInfoAction, {})
  const [rejectState, reject] = useActionState<ReviewState, FormData>(rejectAction, {})
  const [approveState, approve] = useActionState<ReviewState, FormData>(approveAction, {})

  const [confirming, setConfirming] = useState<'approve' | 'reject' | null>(null)

  const decided = status === 'APPROVED' || status === 'REJECTED'

  if (decided) {
    return (
      <section className="cc-panel">
        <div className="cc-panel-head">
          <h2>Decided</h2>
        </div>
        <div className="cc-panel-body">
          <p style={{ margin: 0 }}>
            This application has been {status === 'APPROVED' ? 'approved' : 'rejected'}.
            The record and its full history are kept either way.
          </p>
        </div>
      </section>
    )
  }

  return (
    <>
      <section className="cc-panel">
        <div className="cc-panel-head">
          <h2>Who is reviewing this</h2>
        </div>
        <div className="cc-panel-body">
          <Feedback state={claimState} />
          <Feedback state={releaseState} />
          {assignedToMe ? (
            <>
              <p style={{ marginTop: 0 }}>You have this one.</p>
              <form action={release}>
                <input type="hidden" name="id" value={id} />
                <Submit label="Put it back" className="cc-btn cc-btn-quiet" />
              </form>
            </>
          ) : assignedToName ? (
            <>
              {/* Soft, on purpose. A hard lock traps the application when the
                  reviewer goes on leave. */}
              <p style={{ marginTop: 0 }}>
                Currently being reviewed by <strong>{assignedToName}</strong>.
                You can take it over, and that is recorded.
              </p>
              <form action={claim}>
                <input type="hidden" name="id" value={id} />
                <Submit label="Take over" className="cc-btn cc-btn-quiet" />
              </form>
            </>
          ) : (
            <>
              <p style={{ marginTop: 0 }}>Nobody has claimed this yet.</p>
              <form action={claim}>
                <input type="hidden" name="id" value={id} />
                <Submit label="I will review it" className="cc-btn cc-btn-go" />
              </form>
            </>
          )}
        </div>
      </section>

      <section className="cc-panel">
        <div className="cc-panel-head">
          <h2>Ask the applicant for more</h2>
        </div>
        <div className="cc-panel-body">
          <Feedback state={infoState} />
          <form action={info}>
            <input type="hidden" name="id" value={id} />
            <label className="cc-field">
              <span className="cc-label">What do you need from them?</span>
              <textarea
                name="message"
                className="cc-textarea"
                required
                placeholder="They read this word for word, so name the document or the detail you need."
              />
            </label>
            <Submit label="Send the request" className="cc-btn cc-btn-wait" />
          </form>
        </div>
      </section>

      <section className="cc-panel">
        <div className="cc-panel-head">
          <h2>Internal note</h2>
        </div>
        <div className="cc-panel-body">
          <Feedback state={noteState} />
          <form action={note}>
            <input type="hidden" name="id" value={id} />
            <label className="cc-field">
              <span className="cc-label">Only other reviewers see this</span>
              <textarea name="message" className="cc-textarea" required />
            </label>
            <Submit label="Add note" className="cc-btn cc-btn-quiet" />
          </form>
        </div>
      </section>

      {can.approve && (
        <section className="cc-panel">
          <div className="cc-panel-head">
            <h2>Approve</h2>
          </div>
          <div className="cc-panel-body">
            <Feedback state={approveState} />
            <p style={{ marginTop: 0 }}>
              This creates a live business, issues its public ID, and makes the
              applicant its owner. Clicking twice is safe: the second click
              returns the business the first one made.
            </p>
            <form action={approve}>
              <input type="hidden" name="id" value={id} />
              <label className="cc-field">
                <span className="cc-label">Starting status</span>
                <select name="status" className="cc-select" defaultValue="PILOT">
                  <option value="PILOT">Pilot — live, and marked as trialling</option>
                  <option value="ACTIVE">Active — live, fully onboarded</option>
                </select>
              </label>
              <label className="cc-field">
                <span className="cc-label">Note (optional)</span>
                <input name="note" className="cc-input" />
              </label>
              {confirming === 'approve' ? (
                <div className="cc-actions" style={{ marginTop: 0 }}>
                  <Submit label="Yes, approve and publish" className="cc-btn cc-btn-go" />
                  <button
                    type="button"
                    className="cc-btn cc-btn-quiet"
                    onClick={() => setConfirming(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="cc-btn cc-btn-go"
                  onClick={() => setConfirming('approve')}
                >
                  Approve
                </button>
              )}
            </form>
          </div>
        </section>
      )}

      {can.reject && (
        <section className="cc-panel">
          <div className="cc-panel-head">
            <h2>Reject</h2>
          </div>
          <div className="cc-panel-body">
            <Feedback state={rejectState} />
            <form action={reject}>
              <input type="hidden" name="id" value={id} />
              <label className="cc-field">
                <span className="cc-label">
                  Reason — the applicant reads this
                </span>
                <textarea
                  name="reason"
                  className="cc-textarea"
                  required
                  minLength={10}
                  placeholder="Say what was wrong and whether they can fix it and try again."
                />
              </label>
              {confirming === 'reject' ? (
                <div className="cc-actions" style={{ marginTop: 0 }}>
                  <Submit label="Yes, reject it" className="cc-btn cc-btn-stop" />
                  <button
                    type="button"
                    className="cc-btn cc-btn-quiet"
                    onClick={() => setConfirming(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="cc-btn cc-btn-stop"
                  onClick={() => setConfirming('reject')}
                >
                  Reject
                </button>
              )}
            </form>
          </div>
        </section>
      )}

      {!can.approve && !can.reject && (
        <p className="cc-note">
          You can review and comment on this application but not decide it. The
          Platform Owner grants the approve and reject permissions separately.
        </p>
      )}
    </>
  )
}
