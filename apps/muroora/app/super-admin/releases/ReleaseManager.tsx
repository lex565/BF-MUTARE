'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  blockReleaseAction,
  createReleaseAction,
  deprecateReleaseAction,
  publishReleaseAction,
  setPublicBetaAction,
  updateReleaseAction,
  type ReleaseState,
} from '@/app/super-admin/releases/actions'

interface Row {
  id: string
  platform: string
  version: string
  status: string
  releaseDate: string
  downloadUrl: string | null
  releaseNotes: string | null
  knownIssues: string | null
  minSupportedVersion: string | null
  isMandatory: boolean
  fileSizeBytes: number | null
  blockedReason: string | null
}

function Submit({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? 'Working…' : label}
    </button>
  )
}

function Say({ state }: { state: ReleaseState }) {
  if (state.error) return <p className="cc-note cc-error" role="alert">{state.error}</p>
  if (state.message) return <p className="cc-note" role="status">{state.message}</p>
  return null
}

const TONE: Record<string, string> = {
  PUBLISHED: 'cc-chip-ok',
  DRAFT: 'cc-chip-idle',
  DEPRECATED: 'cc-chip-idle',
  BLOCKED: 'cc-chip-stop',
  COMING_SOON: 'cc-chip-wait',
}

/**
 * Mobile release management.
 *
 * The two buttons that matter are Publish and Block, and they are deliberately
 * not next to each other in weight: publishing is green and ordinary, blocking
 * is red, demands a written reason, and confirms. Blocking is the lever you
 * reach for when a build turns out to be unsafe, and the reason you type is
 * shown to every person running it.
 */
export function ReleaseManager({
  releases,
  betaOpen,
  canPublish,
  isOwner,
}: {
  releases: Row[]
  betaOpen: boolean
  canPublish: boolean
  isOwner: boolean
}) {
  const [createState, create] = useActionState<ReleaseState, FormData>(createReleaseAction, {})
  const [publishState, publish] = useActionState<ReleaseState, FormData>(publishReleaseAction, {})
  const [blockState, block] = useActionState<ReleaseState, FormData>(blockReleaseAction, {})
  const [depState, deprecate] = useActionState<ReleaseState, FormData>(deprecateReleaseAction, {})
  const [editState, edit] = useActionState<ReleaseState, FormData>(updateReleaseAction, {})
  const [betaState, toggleBeta] = useActionState<ReleaseState, FormData>(setPublicBetaAction, {})

  const [editing, setEditing] = useState<string | null>(null)
  const [blocking, setBlocking] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  return (
    <>
      {isOwner && (
        <section className="cc-panel">
          <div className="cc-panel-head">
            <h2>The public beta page</h2>
            <span className={betaOpen ? 'cc-chip cc-chip-ok' : 'cc-chip cc-chip-stop'}>
              {betaOpen ? 'Open' : 'Closed'}
            </span>
          </div>
          <div className="cc-panel-body">
            <Say state={betaState} />
            <p style={{ marginTop: 0 }}>
              {betaOpen
                ? 'Anybody with the address can see /beta and download the published build.'
                : '/beta shows a closed notice and no download is served. Nothing has been deleted.'}
            </p>
            <form action={toggleBeta}>
              <input type="hidden" name="enabled" value={betaOpen ? '0' : '1'} />
              <Submit
                label={betaOpen ? 'Close the beta' : 'Open the beta'}
                className={betaOpen ? 'cc-btn cc-btn-stop' : 'cc-btn cc-btn-go'}
              />
            </form>
          </div>
        </section>
      )}

      <section className="cc-panel">
        <div className="cc-panel-head">
          <h2>Releases</h2>
          <button
            type="button"
            className="cc-btn cc-btn-quiet"
            onClick={() => setAdding((v) => !v)}
          >
            {adding ? 'Close' : 'Add a build'}
          </button>
        </div>

        {adding && (
          <div className="cc-panel-body" style={{ borderBottom: '1px solid var(--cc-line)' }}>
            <Say state={createState} />
            <form action={create}>
              <div style={{ display: 'grid', gap: '0 1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(12rem, 1fr))' }}>
                <label className="cc-field">
                  <span className="cc-label">Platform</span>
                  <select name="platform" className="cc-select" defaultValue="ANDROID">
                    <option value="ANDROID">Android</option>
                    <option value="IOS">iPhone</option>
                  </select>
                </label>
                <label className="cc-field">
                  <span className="cc-label">Version</span>
                  <input name="version" className="cc-input" required placeholder="0.3.0" />
                </label>
                <label className="cc-field">
                  <span className="cc-label">Build number</span>
                  <input name="buildNumber" className="cc-input" inputMode="numeric" />
                </label>
                <label className="cc-field">
                  <span className="cc-label">Size in MB</span>
                  <input name="fileSizeMb" className="cc-input" inputMode="decimal" placeholder="85" />
                </label>
              </div>

              <label className="cc-field">
                <span className="cc-label">Download link</span>
                <input
                  name="downloadUrl"
                  className="cc-input"
                  placeholder="https://expo.dev/artifacts/eas/….apk"
                />
              </label>

              <label className="cc-field">
                <span className="cc-label">
                  Oldest version still allowed to run
                </span>
                <input name="minSupportedVersion" className="cc-input" placeholder="0.2.0" />
              </label>

              <label className="cc-field">
                <span className="cc-label">What changed — testers read this</span>
                <textarea name="releaseNotes" className="cc-textarea" />
              </label>

              <label className="cc-field">
                <span className="cc-label">Known problems (optional)</span>
                <textarea name="knownIssues" className="cc-textarea" />
              </label>

              <label style={{ display: 'flex', gap: '.55rem', alignItems: 'center', marginBottom: '1rem' }}>
                <input type="checkbox" name="isMandatory" />
                <span style={{ fontSize: '.9rem' }}>
                  Everyone must update to this — no &ldquo;Later&rdquo; button
                </span>
              </label>

              <Submit label="Save as draft" className="cc-btn cc-btn-go" />
            </form>
          </div>
        )}

        {releases.length === 0 ? (
          <div className="cc-empty">
            <p>
              <strong>No releases recorded.</strong>
              Add one and the beta page starts working.
            </p>
          </div>
        ) : (
          <div className="cc-scroll">
            <table className="cc-table">
              <thead>
                <tr>
                  <th>Platform</th>
                  <th>Version</th>
                  <th>Status</th>
                  <th>Released</th>
                  <th>Minimum</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {releases.map((r) => (
                  <tr key={r.id}>
                    <td>{r.platform === 'IOS' ? 'iPhone' : 'Android'}</td>
                    <td className="cc-mono">
                      <strong>{r.version}</strong>
                      {r.isMandatory && (
                        <>
                          <br />
                          <span className="cc-chip cc-chip-wait">Mandatory</span>
                        </>
                      )}
                    </td>
                    <td>
                      <span className={`cc-chip ${TONE[r.status] ?? 'cc-chip-idle'}`}>
                        {r.status.replace('_', ' ').toLowerCase()}
                      </span>
                      {r.blockedReason && (
                        <>
                          <br />
                          <span style={{ fontSize: '.8rem' }}>{r.blockedReason}</span>
                        </>
                      )}
                    </td>
                    <td className="cc-mono">{r.releaseDate.slice(0, 10)}</td>
                    <td className="cc-mono">{r.minSupportedVersion ?? '—'}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '.4rem' }}>
                        <button
                          type="button"
                          className="cc-btn cc-btn-quiet"
                          onClick={() => setEditing(editing === r.id ? null : r.id)}
                        >
                          Edit
                        </button>
                        {canPublish && r.status !== 'PUBLISHED' && r.status !== 'COMING_SOON' && (
                          <form action={publish}>
                            <input type="hidden" name="id" value={r.id} />
                            <Submit label="Publish" className="cc-btn cc-btn-go" />
                          </form>
                        )}
                        {canPublish && r.status === 'PUBLISHED' && (
                          <form action={deprecate}>
                            <input type="hidden" name="id" value={r.id} />
                            <Submit label="Retire" className="cc-btn cc-btn-quiet" />
                          </form>
                        )}
                        {canPublish && r.status !== 'BLOCKED' && (
                          <button
                            type="button"
                            className="cc-btn cc-btn-stop"
                            onClick={() => setBlocking(blocking === r.id ? null : r.id)}
                          >
                            Block
                          </button>
                        )}
                      </div>

                      {blocking === r.id && (
                        <form action={block} style={{ marginTop: '.75rem', minWidth: '16rem' }}>
                          <input type="hidden" name="id" value={r.id} />
                          <label className="cc-field">
                            <span className="cc-label">
                              Why — everyone running it sees this
                            </span>
                            <textarea
                              name="reason"
                              className="cc-textarea"
                              required
                              minLength={10}
                              placeholder="This build has a problem that lets somebody into your account. Please install the current one."
                            />
                          </label>
                          <Submit label="Block this build" className="cc-btn cc-btn-stop" />
                        </form>
                      )}

                      {editing === r.id && (
                        <form action={edit} style={{ marginTop: '.75rem', minWidth: '18rem' }}>
                          <input type="hidden" name="id" value={r.id} />
                          <label className="cc-field">
                            <span className="cc-label">Download link</span>
                            <input name="downloadUrl" className="cc-input" defaultValue={r.downloadUrl ?? ''} />
                          </label>
                          <label className="cc-field">
                            <span className="cc-label">Oldest version allowed</span>
                            <input name="minSupportedVersion" className="cc-input" defaultValue={r.minSupportedVersion ?? ''} />
                          </label>
                          <label className="cc-field">
                            <span className="cc-label">What changed</span>
                            <textarea name="releaseNotes" className="cc-textarea" defaultValue={r.releaseNotes ?? ''} />
                          </label>
                          <label className="cc-field">
                            <span className="cc-label">Known problems</span>
                            <textarea name="knownIssues" className="cc-textarea" defaultValue={r.knownIssues ?? ''} />
                          </label>
                          <label style={{ display: 'flex', gap: '.55rem', alignItems: 'center', marginBottom: '1rem' }}>
                            <input type="checkbox" name="isMandatory" defaultChecked={r.isMandatory} />
                            <span style={{ fontSize: '.9rem' }}>Everyone must update</span>
                          </label>
                          <Submit label="Save" className="cc-btn cc-btn-go" />
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="cc-panel-body" style={{ borderTop: '1px solid var(--cc-line)' }}>
          <Say state={publishState} />
          <Say state={blockState} />
          <Say state={depState} />
          <Say state={editState} />
          {!canPublish && (
            <p className="cc-note" style={{ margin: 0 }}>
              You can record and edit builds but not publish or block one. The
              Platform Owner grants that separately.
            </p>
          )}
        </div>
      </section>
    </>
  )
}
