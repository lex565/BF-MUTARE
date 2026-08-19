'use client'

import { useState, useTransition } from 'react'

import { openDocumentAction } from '@/app/super-admin/applications/actions'
import { humanise } from '@/app/super-admin/StatusChip'

/**
 * The verification documents, and the only place in the product where they can
 * be looked at.
 *
 * Before this existed the review page listed the documents as plain text - the
 * reviewer could see THAT an ID had been uploaded and had no way to open it,
 * so an application with every requirement met could not actually be reviewed.
 *
 * Three things about how it opens them, all deliberate:
 *
 *   NOTHING IS FETCHED UNTIL A BUTTON IS PRESSED. The list is metadata. If the
 *   page pre-loaded the images, merely visiting an application would write an
 *   audit row saying you looked at somebody's national ID, which makes the log
 *   useless for the one question it exists to answer.
 *
 *   THE LINK IS NEVER PUT IN THE ADDRESS BAR AND NEVER PERSISTED. It lives in
 *   component state for as long as the tab is open and dies with it. A signed
 *   URL in history or in a cache is a private document with the lock left off.
 *
 *   IT SAYS THAT YOU ARE BEING LOGGED, before you press. Not to threaten the
 *   reviewer - to make the audit trail something they know about rather than
 *   something they discover.
 */

type Doc = {
  id: string
  kind: string
  mimeType: string | null
  sizeBytes: number | null
  createdAt: string
}

type Opened = { url?: string; error?: string; expired?: boolean }

function size(bytes: number | null) {
  if (!bytes) return null
  return bytes < 1024 * 1024
    ? `${Math.round(bytes / 1024)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function DocumentViewer({
  documents,
  canView,
}: {
  documents: Doc[]
  canView: boolean
}) {
  const [opened, setOpened] = useState<Record<string, Opened>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  function open(doc: Doc) {
    setBusy(doc.id)
    startTransition(async () => {
      const result = await openDocumentAction(doc.id)
      setBusy(null)
      setOpened((prev) => ({ ...prev, [doc.id]: result }))

      // A PDF is not something to squeeze into a panel; hand it to the
      // browser's own viewer. Images stay here, because the whole point is
      // comparing the ID against the selfie side by side.
      if (result.url && doc.mimeType === 'application/pdf') {
        window.open(result.url, '_blank', 'noopener,noreferrer')
      }

      /**
       * Mark it stale a little before the signed link actually dies.
       *
       * The link is good for 60 seconds. An <img> already painted keeps
       * showing - the browser has the bytes - but the "open full size" link
       * beside it silently stops working, and a reviewer clicking a dead link
       * concludes the document is missing. Fifty-five seconds, so the label
       * changes while the link still works rather than just after.
       */
      if (result.url) {
        setTimeout(() => {
          setOpened((prev) =>
            prev[doc.id]?.url === result.url
              ? { ...prev, [doc.id]: { ...prev[doc.id], expired: true } }
              : prev,
          )
        }, 55_000)
      }
    })
  }

  if (documents.length === 0) {
    return (
      <div className="cc-empty">
        <p>
          <strong>Nothing uploaded.</strong>
          Verification documents are stored privately and opening one is logged
          against your name.
        </p>
      </div>
    )
  }

  return (
    <div className="cc-panel-body">
      <p className="cc-doc-warning">
        These are identity documents. Opening one records your name, the
        document and the time in the audit log, and the link it produces stops
        working after a minute.
      </p>

      <ul className="cc-docs">
        {documents.map((doc) => {
          const state = opened[doc.id]
          const isImage = (doc.mimeType ?? '').startsWith('image/')

          return (
            <li key={doc.id} className="cc-doc">
              <div className="cc-doc-head">
                <div>
                  <strong>{humanise(doc.kind)}</strong>
                  <span className="cc-mono">
                    {[doc.mimeType ?? 'unknown type', size(doc.sizeBytes)]
                      .filter(Boolean)
                      .join(' · ')}
                    {' · uploaded '}
                    {doc.createdAt.slice(0, 16).replace('T', ' ')}
                  </span>
                </div>

                {canView ? (
                  <button
                    type="button"
                    className="cc-btn cc-btn-quiet"
                    disabled={busy === doc.id}
                    onClick={() => open(doc)}
                  >
                    {busy === doc.id
                      ? 'Opening…'
                      : state?.url
                        ? 'Open again'
                        : 'Open'}
                  </button>
                ) : (
                  <span className="cc-mono">
                    you do not have permission to open this
                  </span>
                )}
              </div>

              {state?.error && (
                <p className="cc-note cc-error" role="alert">
                  {state.error}
                </p>
              )}

              {state?.url && isImage && (
                <figure className="cc-doc-view">
                  {/* Deliberately a plain <img>, not next/image. next/image
                      proxies through the optimiser, which would put a copy of
                      somebody's national ID in Next's on-disk image cache,
                      outliving the sixty-second link that was the whole
                      control. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={state.url} alt={humanise(doc.kind)} />
                  <figcaption>
                    {state.expired ? (
                      <>This link has expired. Press Open again for a new one.</>
                    ) : (
                      <a href={state.url} target="_blank" rel="noopener noreferrer">
                        Open full size in a new tab
                      </a>
                    )}
                  </figcaption>
                </figure>
              )}

              {state?.url && !isImage && (
                <p className="cc-doc-note">
                  {state.expired
                    ? 'Opened in a new tab. That link has expired now - press Open again for another.'
                    : 'Opened in a new tab. If nothing appeared, your browser blocked the pop-up.'}
                </p>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
