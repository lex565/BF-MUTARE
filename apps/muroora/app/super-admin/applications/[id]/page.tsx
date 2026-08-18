import Link from 'next/link'
import { notFound } from 'next/navigation'

import { getApplication, ApplicationError } from '@/lib/platform/applications'
import { can, requirePermission } from '@/lib/platform/auth'
import { StatusChip, humanise } from '@/app/super-admin/StatusChip'
import { ReviewPanel } from '@/app/super-admin/applications/[id]/ReviewPanel'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Application' }

/**
 * One application, and the decision about it.
 *
 * The left column is what they said; the right is what you can do about it.
 * Contact details are shown to a reviewer because a reviewer needs them - they
 * remain absent from every public payload until the business is approved and a
 * contact release is recorded.
 */
export default async function ApplicationPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const admin = await requirePermission('business_applications.review')
  const { id } = await params

  let data
  try {
    data = await getApplication(id)
  } catch (error) {
    if (error instanceof ApplicationError) notFound()
    throw error
  }

  const { application, applicant, history, documents, createdBusiness, assignedToName } =
    data

  const details = (application.details ?? {}) as Record<string, unknown>

  return (
    <>
      <header className="cc-head">
        <p className="cc-eyebrow">
          <Link href="/super-admin/applications" style={{ color: 'inherit' }}>
            ← Applications
          </Link>
        </p>
        <h1 className="cc-title">{application.businessName}</h1>
        <p className="cc-sub">
          <StatusChip status={application.status} /> · {humanise(application.kind)} ·{' '}
          {application.city}
        </p>
      </header>

      {application.status === 'NEEDS_INFORMATION' && application.infoRequested && (
        <p className="cc-note">
          <strong>Waiting on the applicant.</strong> They were asked:{' '}
          {application.infoRequested}
        </p>
      )}

      {createdBusiness && (
        <p className="cc-note">
          Approved. This became <strong>{createdBusiness.publicId}</strong> —{' '}
          <Link href={`/stores/${createdBusiness.slug}`}>view the storefront</Link>.
        </p>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)',
          gap: '1.75rem',
          alignItems: 'start',
        }}
        className="cc-split"
      >
        <div>
          <section className="cc-panel">
            <div className="cc-panel-head">
              <h2>What they told us</h2>
            </div>
            <div className="cc-panel-body">
              <dl className="cc-defs">
                <div>
                  <dt>Business name</dt>
                  <dd>{application.businessName}</dd>
                </div>
                <div>
                  <dt>Type</dt>
                  <dd>{humanise(application.kind)}</dd>
                </div>
                <div>
                  <dt>City</dt>
                  <dd>{application.city}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>{application.address || 'Not given'}</dd>
                </div>
                <div>
                  <dt>Phone</dt>
                  <dd>{application.contactPhone || 'Not given'}</dd>
                </div>
                <div>
                  <dt>WhatsApp</dt>
                  <dd>{application.whatsapp || 'Not given'}</dd>
                </div>
                <div>
                  <dt>Email</dt>
                  <dd>{application.contactEmail || 'Not given'}</dd>
                </div>
                <div>
                  <dt>Submitted</dt>
                  <dd>
                    {application.submittedAt
                      ? application.submittedAt.toISOString().slice(0, 16).replace('T', ' ')
                      : 'Unknown'}
                  </dd>
                </div>
              </dl>

              {application.summary && (
                <>
                  <p className="cc-label" style={{ marginTop: '1.5rem' }}>
                    What they do
                  </p>
                  <p style={{ margin: 0 }}>{application.summary}</p>
                </>
              )}

              {application.note && (
                <>
                  <p className="cc-label" style={{ marginTop: '1.5rem' }}>
                    Anything else they said
                  </p>
                  <p style={{ margin: 0 }}>{application.note}</p>
                </>
              )}

              {Object.keys(details).length > 0 && (
                <>
                  <p className="cc-label" style={{ marginTop: '1.5rem' }}>
                    Answers for a {humanise(application.kind).toLowerCase()} business
                  </p>
                  <dl className="cc-defs">
                    {Object.entries(details).map(([key, value]) => (
                      <div key={key}>
                        <dt>{key.replace(/_/g, ' ')}</dt>
                        <dd>{String(value)}</dd>
                      </div>
                    ))}
                  </dl>
                </>
              )}
            </div>
          </section>

          <section className="cc-panel">
            <div className="cc-panel-head">
              <h2>Applicant</h2>
            </div>
            <div className="cc-panel-body">
              <dl className="cc-defs">
                <div>
                  <dt>Name</dt>
                  <dd>{applicant?.name ?? 'Unknown'}</dd>
                </div>
                <div>
                  <dt>Account email</dt>
                  <dd>{applicant?.email ?? 'Unknown'}</dd>
                </div>
                <div>
                  <dt>Phone on account</dt>
                  <dd>{applicant?.phone ?? 'Not given'}</dd>
                </div>
              </dl>
            </div>
          </section>

          <section className="cc-panel">
            <div className="cc-panel-head">
              <h2>Documents</h2>
            </div>
            {documents.length === 0 ? (
              <div className="cc-empty">
                <p>
                  <strong>Nothing uploaded.</strong>
                  Verification documents are stored privately and opening one is
                  logged against your name.
                </p>
              </div>
            ) : (
              <div className="cc-panel-body">
                <ul style={{ margin: 0, paddingLeft: '1.1rem' }}>
                  {documents.map((d) => (
                    <li key={d.id} style={{ marginBottom: '.4rem' }}>
                      {humanise(d.kind)} — {d.originalName ?? 'file'}{' '}
                      {can(admin, 'sensitive_documents.view') ? (
                        <span className="cc-mono">({d.mimeType})</span>
                      ) : (
                        <span className="cc-mono">
                          — you do not have permission to open this
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="cc-panel">
            <div className="cc-panel-head">
              <h2>History</h2>
            </div>
            <ul className="cc-timeline cc-panel-body">
              {history.map((h) => (
                <li key={h.id}>
                  <time dateTime={h.createdAt.toISOString()}>
                    {h.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                  </time>
                  <div>
                    <strong className={h.internal ? 'cc-internal' : undefined}>
                      {humanise(h.event)}
                      {h.internal ? ' (internal)' : ''}
                    </strong>
                    <p>
                      {h.actorName ?? 'System'}
                      {h.message ? ` — ${h.message}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div>
          <ReviewPanel
            id={application.id}
            status={application.status}
            assignedToMe={application.assignedTo === admin.user.id}
            assignedToName={
              application.assignedTo === admin.user.id ? null : assignedToName
            }
            can={{
              review: true,
              approve: can(admin, 'business_applications.approve'),
              reject: can(admin, 'business_applications.reject'),
            }}
          />
        </div>
      </div>
    </>
  )
}
