import {
  countOpenSecurityReports,
  listBetaFeedback,
  listReleases,
  publicBetaEnabled,
} from '@/lib/platform/releases'
import { can, requirePermission } from '@/lib/platform/auth'
import { ReleaseManager } from '@/app/super-admin/releases/ReleaseManager'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Mobile app' }

/**
 * Mobile releases and tester feedback.
 *
 * Security reports are fetched only when the caller holds
 * `beta_feedback.security`. The filter is in the QUERY, not in the template:
 * an unfixed security report is a working exploit written down, and a `where`
 * clause has to be deliberately removed whereas a conditional in JSX can be
 * lost in a refactor without anybody noticing.
 */
export default async function ReleasesPage() {
  const admin = await requirePermission('releases.manage')

  const maySeeSecurity = can(admin, 'beta_feedback.security')
  const maySeeFeedback = can(admin, 'beta_feedback.view') || maySeeSecurity

  const [releases, betaOpen, feedback, securityCount] = await Promise.all([
    listReleases(),
    publicBetaEnabled(),
    maySeeFeedback ? listBetaFeedback(maySeeSecurity) : Promise.resolve([]),
    maySeeSecurity ? countOpenSecurityReports() : Promise.resolve(0),
  ])

  return (
    <>
      <header className="cc-head">
        <p className="cc-eyebrow">Mobile app</p>
        <h1 className="cc-title">What testers are being offered</h1>
        <p className="cc-sub">
          The beta page and the download link both read from here. Publishing a
          build sends every tester to it; blocking one tells everybody running
          it to stop.
        </p>
      </header>

      {securityCount > 0 && (
        <p className="cc-note cc-error" role="alert">
          <strong>
            {securityCount} unread security report
            {securityCount === 1 ? '' : 's'}.
          </strong>{' '}
          These are not shown to administrators without the security
          permission. Read them before publishing anything else.
        </p>
      )}

      <ReleaseManager
        releases={releases.map((r) => ({
          id: r.id,
          platform: r.platform,
          version: r.version,
          status: r.status,
          releaseDate: r.releaseDate.toISOString(),
          downloadUrl: r.downloadUrl,
          releaseNotes: r.releaseNotes,
          knownIssues: r.knownIssues,
          minSupportedVersion: r.minSupportedVersion,
          isMandatory: r.isMandatory,
          fileSizeBytes: r.fileSizeBytes,
          blockedReason: r.blockedReason,
        }))}
        betaOpen={betaOpen}
        canPublish={can(admin, 'releases.publish')}
        isOwner={admin.isOwner}
      />

      {maySeeFeedback && (
        <section className="cc-panel">
          <div className="cc-panel-head">
            <h2>Tester feedback</h2>
            <span className="cc-mono">
              {maySeeSecurity ? 'including security' : 'security reports hidden'}
            </span>
          </div>
          {feedback.length === 0 ? (
            <div className="cc-empty">
              <p>
                <strong>Nothing yet.</strong>
                Reports from /beta appear here.
              </p>
            </div>
          ) : (
            <div className="cc-scroll">
              <table className="cc-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Kind</th>
                    <th>What they said</th>
                    <th>Version</th>
                    <th>Phone</th>
                    <th>Contact</th>
                  </tr>
                </thead>
                <tbody>
                  {feedback.map((f) => (
                    <tr key={f.id}>
                      <td className="cc-mono">
                        {f.createdAt.toISOString().slice(0, 16).replace('T', ' ')}
                      </td>
                      <td>
                        <span
                          className={
                            f.isSecurity ? 'cc-chip cc-chip-stop' : 'cc-chip cc-chip-idle'
                          }
                        >
                          {f.kind.toLowerCase()}
                        </span>
                      </td>
                      <td style={{ maxWidth: '28rem' }}>{f.message}</td>
                      <td className="cc-mono">{f.appVersion ?? '—'}</td>
                      <td>{f.device ?? '—'}</td>
                      <td className="cc-mono">{f.contact ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  )
}
