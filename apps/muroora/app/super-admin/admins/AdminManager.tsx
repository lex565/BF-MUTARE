'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  permissionsAction,
  promoteAction,
  statusAction,
  type AdminState,
} from '@/app/super-admin/admins/actions'
import {
  DEFAULT_REVIEWER_PERMISSIONS,
  PERMISSION_GROUPS,
  PLATFORM_PERMISSIONS,
  type PlatformPermission,
} from '@/lib/platform/permissions'
import type { AdminRow } from '@/lib/platform/admins'

/**
 * The owner's administrator screen.
 *
 * The permission editor is grouped rather than a flat column of seventeen
 * checkboxes, because the owner is making a handful of decisions ("can they
 * decide applications? can they see identity documents?") and not seventeen
 * independent ones. Sensitive sits alone at the bottom with its own warning:
 * it is other people's national ID documents.
 */

function Submit({ label, className }: { label: string; className: string }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? 'Saving…' : label}
    </button>
  )
}

function Feedback({ state }: { state: AdminState }) {
  if (state.error) return <p className="cc-note cc-error" role="alert">{state.error}</p>
  if (state.message) return <p className="cc-note" role="status">{state.message}</p>
  return null
}

function PermissionPicker({ selected }: { selected: PlatformPermission[] }) {
  return (
    <div style={{ display: 'grid', gap: '1.1rem' }}>
      {PERMISSION_GROUPS.map((group) => (
        <fieldset
          key={group.label}
          style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}
        >
          <legend className="cc-label" style={{ padding: 0 }}>
            {group.label}
          </legend>
          {group.note && (
            <p
              style={{
                margin: '0 0 .5rem',
                fontSize: '.8rem',
                color: 'var(--cc-ink-faint)',
              }}
            >
              {group.note}
            </p>
          )}
          <div style={{ display: 'grid', gap: '.35rem' }}>
            {group.permissions.map((p) => (
              <label
                key={p}
                style={{
                  display: 'flex',
                  gap: '.55rem',
                  alignItems: 'flex-start',
                  fontSize: '.88rem',
                }}
              >
                <input
                  type="checkbox"
                  name="permissions"
                  value={p}
                  defaultChecked={selected.includes(p)}
                  style={{ marginTop: '.25rem' }}
                />
                <span>{PLATFORM_PERMISSIONS[p]}</span>
              </label>
            ))}
          </div>
        </fieldset>
      ))}
    </div>
  )
}

export function AdminManager({
  admins,
  activeCount,
  limit,
}: {
  admins: AdminRow[]
  activeCount: number
  limit: number
}) {
  const [promoteState, promote] = useActionState<AdminState, FormData>(promoteAction, {})
  const [permState, savePerms] = useActionState<AdminState, FormData>(permissionsAction, {})
  const [statusState, changeStatus] = useActionState<AdminState, FormData>(statusAction, {})
  const [editing, setEditing] = useState<string | null>(null)

  const owner = admins.find((a) => a.role === 'PLATFORM_OWNER')
  const supers = admins.filter((a) => a.role === 'SUPER_ADMIN')
  const full = activeCount >= limit

  return (
    <>
      <section className="cc-panel">
        <div className="cc-panel-head">
          <h2>Platform Owner</h2>
        </div>
        <div className="cc-panel-body">
          {owner ? (
            <>
              <p style={{ marginTop: 0 }}>
                <strong>{owner.name ?? owner.email}</strong> — {owner.email}
              </p>
              <p style={{ margin: 0, color: 'var(--cc-ink-soft)' }}>
                Holds every permission by being the owner, which is why none are
                listed and none can be revoked. Ownership moves by a migration,
                deliberately, and not from this screen.
              </p>
            </>
          ) : (
            <p className="cc-note cc-error" style={{ margin: 0 }}>
              No Platform Owner exists. Nobody can manage administrators until
              one is established by migration.
            </p>
          )}
        </div>
      </section>

      <section className="cc-panel">
        <div className="cc-panel-head">
          <h2>Super Admins</h2>
          <span className="cc-mono">
            {activeCount} active of {limit}
          </span>
        </div>

        {supers.length === 0 ? (
          <div className="cc-empty">
            <p>
              <strong>None yet.</strong>
              Add one below. They will be able to see the Control Center
              immediately and to do only what you tick.
            </p>
          </div>
        ) : (
          <div className="cc-scroll">
            <table className="cc-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Status</th>
                  <th>Permissions</th>
                  <th>Added by</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {supers.map((a) => (
                  <tr key={a.platformRoleId}>
                    <td><strong>{a.name ?? '—'}</strong></td>
                    <td className="cc-mono">{a.email}</td>
                    <td>
                      <span
                        className={
                          a.status === 'ACTIVE'
                            ? 'cc-chip cc-chip-ok'
                            : a.status === 'INVITED'
                              ? 'cc-chip cc-chip-wait'
                              : 'cc-chip cc-chip-stop'
                        }
                      >
                        {a.status.toLowerCase()}
                      </span>
                    </td>
                    <td>
                      {a.permissions.length === 0
                        ? 'None — can look, cannot act'
                        : `${a.permissions.length} granted`}
                    </td>
                    <td>{a.grantedByName ?? '—'}</td>
                    <td>
                      <button
                        type="button"
                        className="cc-btn cc-btn-quiet"
                        onClick={() =>
                          setEditing(editing === a.platformRoleId ? null : a.platformRoleId)
                        }
                      >
                        {editing === a.platformRoleId ? 'Close' : 'Manage'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {editing && (
          <div className="cc-panel-body" style={{ borderTop: '1px solid var(--cc-line)' }}>
            <Feedback state={permState} />
            <Feedback state={statusState} />

            {(() => {
              const target = supers.find((a) => a.platformRoleId === editing)
              if (!target) return null
              return (
                <>
                  <h3 style={{ marginTop: 0 }}>{target.name ?? target.email}</h3>

                  <form action={savePerms}>
                    <input type="hidden" name="platformRoleId" value={target.platformRoleId} />
                    <PermissionPicker selected={target.permissions} />
                    <div className="cc-actions">
                      <Submit label="Save permissions" className="cc-btn cc-btn-go" />
                    </div>
                  </form>

                  <form action={changeStatus} style={{ marginTop: '2rem' }}>
                    <input type="hidden" name="platformRoleId" value={target.platformRoleId} />
                    <label className="cc-field">
                      <span className="cc-label">Access</span>
                      <select name="status" className="cc-select" defaultValue={target.status}>
                        <option value="ACTIVE">Active</option>
                        <option value="SUSPENDED">Suspended — temporarily blocked</option>
                        <option value="DEACTIVATED">Deactivated — access removed</option>
                      </select>
                    </label>
                    <label className="cc-field">
                      <span className="cc-label">Reason (recorded)</span>
                      <input name="reason" className="cc-input" />
                    </label>
                    <Submit label="Change access" className="cc-btn cc-btn-stop" />
                  </form>
                </>
              )
            })()}
          </div>
        )}
      </section>

      <section className="cc-panel">
        <div className="cc-panel-head">
          <h2>Add a Super Admin</h2>
        </div>
        <div className="cc-panel-body">
          <Feedback state={promoteState} />
          {full ? (
            <p className="cc-note" style={{ margin: 0 }}>
              All {limit} places are taken. Deactivate somebody above before
              adding another.
            </p>
          ) : (
            <form action={promote}>
              <p style={{ marginTop: 0, color: 'var(--cc-ink-soft)' }}>
                The person needs a Musuwo account already. Ask them to register
                first, then promote the address they used — that way you know
                the address reaches them.
              </p>
              <label className="cc-field">
                <span className="cc-label">Their email</span>
                <input
                  name="email"
                  type="email"
                  required
                  className="cc-input"
                  autoComplete="off"
                  inputMode="email"
                  autoCapitalize="none"
                />
              </label>
              <p className="cc-label">What they may do</p>
              <PermissionPicker selected={DEFAULT_REVIEWER_PERMISSIONS} />
              <div className="cc-actions">
                <Submit label="Make Super Admin" className="cc-btn cc-btn-go" />
              </div>
            </form>
          )}
        </div>
      </section>
    </>
  )
}
