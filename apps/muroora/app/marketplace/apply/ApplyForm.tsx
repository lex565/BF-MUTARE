'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  saveAction,
  startAction,
  submitAction,
  uploadAction,
  type ApplyState,
} from '@/app/marketplace/apply/actions'
import { PROVIDER_TYPES, type Readiness } from '@/lib/platform/provider-types'

/**
 * Registering a business.
 *
 * THREE DOORS, DELIBERATELY DIFFERENT SIZES.
 *
 *   STARTING is one question - what kind of trader are you. Nothing else, no
 *   documents, no account details. Somebody without a utility bill in her own
 *   name must be able to begin, see what is needed, and come back next week.
 *   The previous version was submit-or-nothing, so she left.
 *
 *   SAVING is always allowed. The checklist updates as things arrive.
 *
 *   SUBMITTING only opens when the mandatory items for that provider type are
 *   present - and the button being disabled is a courtesy, not the control.
 *   The server re-checks every submission, because a disabled button is the
 *   first thing anybody bypasses.
 *
 * The copy avoids the word "verification" where a plainer one exists. Somebody
 * reading this on a phone in Sakubva should not have to work out what
 * "documentary evidence of residence" means: it says "something showing that
 * address", and the note underneath says renting is fine.
 */

function Submit({ label, className, disabled }: { label: string; className: string; disabled?: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {pending ? 'Working…' : label}
    </button>
  )
}

function Say({ state }: { state: ApplyState }) {
  if (state.error) {
    return (
      <p role="alert" className="my-4 border-l-4 border-accent bg-accent-wash px-5 py-4 text-small">
        {state.error}
      </p>
    )
  }
  if (state.message) {
    return (
      <p role="status" className="my-4 border-l-4 border-support bg-paper-sunk px-5 py-4 text-small">
        {state.message}
      </p>
    )
  }
  return null
}

const field =
  'mt-2 w-full border border-rule bg-paper px-4 py-3 text-body focus:border-accent focus:outline-none'
const label = 'block font-mono text-micro uppercase tracking-label text-ink-faint'

/* ------------------------------------------------------------ step one */

export function ChooseProviderType() {
  const [state, act] = useActionState<ApplyState, FormData>(startAction, {})

  return (
    <div className="max-w-measure">
      <Say state={state} />
      <p className="text-ink-soft">
        One question to begin. You do not need any documents yet - you will see
        exactly what is needed once you choose, and you can come back to it.
      </p>

      <div className="mt-8 space-y-3">
        {PROVIDER_TYPES.map((t) => (
          <form key={t.value} action={act}>
            <input type="hidden" name="providerType" value={t.value} />
            <button
              type="submit"
              className="w-full border border-rule bg-paper p-6 text-left transition-colors hover:border-accent"
            >
              <strong className="block text-h3">{t.label}</strong>
              <span className="mt-2 block text-small text-ink-soft">{t.blurb}</span>
            </button>
          </form>
        ))}
      </div>
    </div>
  )
}

/* ---------------------------------------------------------- checklist */

function Checklist({ readiness }: { readiness: Readiness }) {
  return (
    <aside className="border border-rule bg-paper-sunk p-6">
      <h2 className="font-mono text-micro uppercase tracking-label text-ink-faint">
        What Musuwo needs
      </h2>
      <p className="mt-3 text-small text-ink-soft">
        {readiness.canSubmit
          ? 'Everything is here. You can send it now.'
          : `${readiness.missing.length} still to go. Nothing is lost if you stop and come back.`}
      </p>

      <ul className="mt-5 space-y-3">
        {readiness.requirements.map((r) => (
          <li key={r.requirement} className="flex gap-3 text-small">
            <span
              aria-hidden
              className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-bold ${
                r.met ? 'bg-support text-white' : 'border border-rule bg-paper text-ink-faint'
              }`}
            >
              {r.met ? '✓' : ''}
            </span>
            <span>
              <span className={r.met ? 'text-ink-faint line-through' : 'text-ink'}>
                {r.label}
              </span>
              {!r.isMandatory && (
                <span className="ml-2 font-mono text-micro uppercase tracking-label text-ink-faint">
                  optional
                </span>
              )}
              {r.note && <span className="mt-1 block text-ink-faint">{r.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </aside>
  )
}

/* ------------------------------------------------------------ uploads */

/**
 * Shrink a photo in the browser before it is sent.
 *
 * WHY THIS IS WORTH THIRTY LINES. A photo of an ID off any modern phone is
 * 2-4 MB. Sending that over mobile data in Mutare is slow, costs the person
 * money by the megabyte, and fails often enough that they give up - and it was
 * also being rejected outright by Next's 1 MB server-action limit, which is
 * the bug that made this form impossible to finish.
 *
 * A 1600px JPEG is a few hundred KB and is far more than enough to read an ID
 * number off. So the upload is usually ten times smaller and ten times more
 * likely to arrive.
 *
 * FALLS BACK TO THE ORIGINAL, deliberately, whenever the browser cannot decode
 * the file: PDFs, HEIC on most desktops, anything unexpected. Refusing those
 * would mean an iPhone user simply cannot apply, which is far worse than
 * sending a larger file. The 12 MB server limit covers that case.
 */
async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  // Already small enough to not be worth the risk of re-encoding.
  if (file.size < 600 * 1024) return file

  try {
    const bitmap = await createImageBitmap(file)
    const MAX = 1600
    const scale = Math.min(1, MAX / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 2 * 1024 * 1024) return file

    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const blob = await new Promise<Blob | null>((resolve) =>
      // 0.85 keeps an ID number crisply readable. Lower starts to mush the
      // small print, which is the only part that matters here.
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    if (!blob || blob.size >= file.size) return file

    return new File([blob], 'upload.jpg', { type: 'image/jpeg' })
  } catch {
    // Cannot decode it. Send what they chose.
    return file
  }
}

/** 8MB, matching the server. Checked here so the message arrives instantly. */
const MAX_UPLOAD = 8 * 1024 * 1024

function Upload({
  applicationId,
  kind,
  title,
  note,
  done,
}: {
  applicationId: string
  kind: string
  title: string
  note?: string
  done: boolean
}) {
  const [state, act] = useActionState<ApplyState, FormData>(uploadAction, {})
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)

  /**
   * Intercepted rather than a plain form action, because the file has to be
   * shrunk before it is sent. Submitting the raw input is what produced a
   * failed request with no explanation.
   */
  const send = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setProblem(null)

    const form = event.currentTarget
    const input = form.elements.namedItem('file') as HTMLInputElement
    const chosen = input.files?.[0]

    if (!chosen || chosen.size === 0) {
      setProblem('Choose a file first.')
      return
    }

    setBusy(true)
    try {
      const file = await shrinkImage(chosen)

      if (file.size > MAX_UPLOAD) {
        setProblem(
          `That file is ${(file.size / 1024 / 1024).toFixed(1)}MB, and the limit is 8MB. Take a photo rather than sending a scan, or send a smaller PDF.`,
        )
        return
      }

      const data = new FormData()
      data.set('applicationId', applicationId)
      data.set('kind', kind)
      data.set('file', file)
      act(data)
      form.reset()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="border border-rule bg-paper p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <strong className="text-body">{title}</strong>
        {done && <span className="chip chip-live">Received</span>}
      </div>
      {note && <p className="mt-2 text-small text-ink-soft">{note}</p>}

      {problem && (
        <p role="alert" className="my-4 border-l-4 border-accent bg-accent-wash px-5 py-4 text-small">
          {problem}
        </p>
      )}
      <Say state={state} />

      <form onSubmit={send} className="mt-4 flex flex-wrap items-center gap-3">
        <input
          type="file"
          name="file"
          required
          accept="image/*,application/pdf"
          className="max-w-full text-small"
        />
        <button
          type="submit"
          disabled={busy}
          className="bg-support px-6 py-3 font-mono text-micro font-bold uppercase tracking-label text-white transition-colors hover:bg-ink disabled:opacity-60"
        >
          {busy ? 'Preparing…' : done ? 'Replace' : 'Upload'}
        </button>
      </form>
    </div>
  )
}

/* ------------------------------------------------------------- step two */

export function ApplicationForm({
  application,
  readiness,
  evidenceTypes,
  documentKinds,
  categories,
}: {
  application: Record<string, string | null> & { id: string; status: string }
  readiness: Readiness
  evidenceTypes: { code: string; label: string; note: string | null }[]
  documentKinds: string[]
  categories: { value: string; label: string }[]
}) {
  const [saveState, save] = useActionState<ApplyState, FormData>(saveAction, {})
  const [submitState, send] = useActionState<ApplyState, FormData>(submitAction, {})

  const needs = new Set(readiness.requirements.map((r) => r.requirement))
  const have = new Set(documentKinds)
  const sent = application.status !== 'DRAFT' && application.status !== 'NEEDS_INFORMATION'

  if (sent) {
    return (
      <div className="max-w-measure border border-rule bg-paper p-8">
        <h2 className="text-h2">It is with Musuwo</h2>
        <p className="mt-4 text-ink-soft">
          A person reads every application. We will come back to you, and if
          something is missing we will say exactly what.
        </p>
        <p className="mt-6 font-mono text-micro uppercase tracking-label text-ink-faint">
          Status: {application.status.replace(/_/g, ' ').toLowerCase()}
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
      <div>
        {application.infoRequested && (
          <p className="mb-8 border-l-4 border-accent bg-accent-wash px-5 py-4">
            <strong>Musuwo asked for something:</strong> {application.infoRequested}
          </p>
        )}

        <Say state={saveState} />

        <form action={save} className="space-y-6">
          <input type="hidden" name="applicationId" value={application.id} />

          <fieldset className="space-y-5 border border-rule bg-paper p-6">
            <legend className="px-2 font-mono text-micro uppercase tracking-label text-accent">
              About what you offer
            </legend>

            <div>
              <label htmlFor="businessName" className={label}>
                What do you want to be called?
              </label>
              <input
                id="businessName" name="businessName" required maxLength={120}
                defaultValue={application.businessName ?? ''} className={field}
                placeholder="The name customers will see"
              />
            </div>

            {needs.has('category') && (
              <div>
                <label htmlFor="kind" className={label}>What do you sell or do?</label>
                <select id="kind" name="kind" defaultValue={application.kind ?? 'RETAIL'} className={field}>
                  {categories.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label htmlFor="summary" className={label}>In a sentence, what do you offer?</label>
              <textarea
                id="summary" name="summary" rows={3} maxLength={400}
                defaultValue={application.summary ?? ''} className={field}
                placeholder="Fresh bread and buns, baked every morning."
              />
            </div>

            <div>
              <label htmlFor="city" className={label}>Town or city</label>
              <input id="city" name="city" defaultValue={application.city ?? 'Mutare'} className={field} />
            </div>

            {needs.has('operating_area') && (
              <div>
                <label htmlFor="operatingArea" className={label}>Where do you trade?</label>
                <input
                  id="operatingArea" name="operatingArea"
                  defaultValue={application.operatingArea ?? ''} className={field}
                  placeholder="Sakubva, Dangamvura and town"
                />
                <p className="mt-2 text-small text-ink-faint">
                  The areas you cover or the place customers find you. This one
                  customers do see.
                </p>
              </div>
            )}
          </fieldset>

          <fieldset className="space-y-5 border border-rule bg-paper p-6">
            <legend className="px-2 font-mono text-micro uppercase tracking-label text-accent">
              How we reach you
            </legend>

            <div>
              <label htmlFor="contactPhone" className={label}>Phone</label>
              <input
                id="contactPhone" name="contactPhone" inputMode="tel" maxLength={40}
                defaultValue={application.contactPhone ?? ''} className={field}
                placeholder="+263 77 000 0000"
              />
            </div>
            <div>
              <label htmlFor="whatsapp" className={label}>WhatsApp, if different</label>
              <input id="whatsapp" name="whatsapp" inputMode="tel" maxLength={40}
                defaultValue={application.whatsapp ?? ''} className={field} />
            </div>
            <div>
              <label htmlFor="contactEmail" className={label}>Email</label>
              <input id="contactEmail" name="contactEmail" type="email" autoCapitalize="none"
                defaultValue={application.contactEmail ?? ''} className={field} />
            </div>
            <p className="text-small text-ink-faint">
              Your number is not shown to customers until you are approved and
              you choose to release it.
            </p>
          </fieldset>

          {(needs.has('legal_name') || needs.has('registration_number')) && (
            <fieldset className="space-y-5 border border-rule bg-paper p-6">
              <legend className="px-2 font-mono text-micro uppercase tracking-label text-accent">
                Who you are
              </legend>

              {needs.has('legal_name') && (
                <>
                  <div>
                    <label htmlFor="legalName" className={label}>
                      Full name, as it appears on your ID
                    </label>
                    <input id="legalName" name="legalName" maxLength={160}
                      defaultValue={application.legalName ?? ''} className={field} />
                  </div>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="idType" className={label}>Which ID</label>
                      <select id="idType" name="idType" defaultValue={application.idType ?? 'NATIONAL_ID'} className={field}>
                        <option value="NATIONAL_ID">National ID</option>
                        <option value="PASSPORT">Passport</option>
                        <option value="DRIVERS_LICENCE">Driver&rsquo;s licence</option>
                      </select>
                    </div>
                    <div>
                      <label htmlFor="idNumber" className={label}>ID number</label>
                      <input id="idNumber" name="idNumber" maxLength={60}
                        defaultValue={application.idNumber ?? ''} className={field} />
                    </div>
                  </div>
                </>
              )}

              {needs.has('registration_number') && (
                <div>
                  <label htmlFor="registrationNumber" className={label}>
                    Company registration number
                  </label>
                  <input id="registrationNumber" name="registrationNumber" maxLength={80}
                    defaultValue={application.registrationNumber ?? ''} className={field} />
                </div>
              )}

              <p className="text-small text-ink-faint">
                Your ID number is never shown to customers. Only a Musuwo
                reviewer with permission can see it, and every time one is
                opened it is recorded against their name.
              </p>
            </fieldset>
          )}

          {needs.has('address') && (
            <fieldset className="space-y-5 border border-rule bg-paper p-6">
              <legend className="px-2 font-mono text-micro uppercase tracking-label text-accent">
                Your address
              </legend>

              <div>
                <label htmlFor="residentialAddress" className={label}>Where you live</label>
                <textarea id="residentialAddress" name="residentialAddress" rows={2}
                  defaultValue={application.residentialAddress ?? ''} className={field} />
                <p className="mt-2 text-small text-ink-faint">
                  <strong>Never shown to customers.</strong> It is how Musuwo
                  knows a real person stands behind the business.
                </p>
              </div>

              {needs.has('address_evidence') && (
                <div>
                  <label htmlFor="addressEvidenceType" className={label}>
                    What will you show us?
                  </label>
                  <select id="addressEvidenceType" name="addressEvidenceType"
                    defaultValue={application.addressEvidenceType ?? ''} className={field}>
                    <option value="">Choose one</option>
                    {evidenceTypes.map((e) => (
                      <option key={e.code} value={e.code}>{e.label}</option>
                    ))}
                  </select>
                  <p className="mt-2 text-small text-ink-faint">
                    Renting, living with family or being in student
                    accommodation are all fine. We are confirming where you are,
                    not that you own anything.
                  </p>
                </div>
              )}
            </fieldset>
          )}

          <div>
            <label htmlFor="note" className={label}>Anything else we should know?</label>
            <textarea id="note" name="note" rows={3} maxLength={2000}
              defaultValue={application.note ?? ''} className={field} />
          </div>

          <Submit
            label="Save what I have"
            className="w-full bg-support px-8 py-4 font-mono text-small font-bold uppercase tracking-label text-white transition-colors hover:bg-ink"
          />
        </form>

        {/* --------------------------------------------------- documents */}
        <h2 className="mt-12 text-h2">Documents</h2>
        <p className="mt-2 max-w-measure text-ink-soft">
          Photographs from your phone are fine. These go somewhere only Musuwo
          reviewers can open - they are never public and never shown to
          customers.
        </p>

        <div className="mt-6 space-y-4">
          {needs.has('id_document') && (
            <Upload applicationId={application.id} kind="ID_DOCUMENT" done={have.has('ID_DOCUMENT')}
              title="A photo of your ID"
              note="All four corners visible, and readable." />
          )}
          {needs.has('id_selfie') && (
            <Upload applicationId={application.id} kind="ID_SELFIE" done={have.has('ID_SELFIE')}
              title="A photo of you holding that same ID"
              note="Your face and the ID in one picture. It is how we know the ID is yours." />
          )}
          {needs.has('address_evidence') && (
            <Upload applicationId={application.id} kind="PROOF_OF_ADDRESS" done={have.has('PROOF_OF_ADDRESS')}
              title="Something showing your address"
              note="If it is a bank statement, cover the transactions. We only need the address." />
          )}
          {needs.has('registration_document') && (
            <Upload applicationId={application.id} kind="BUSINESS_REGISTRATION" done={have.has('BUSINESS_REGISTRATION')}
              title="Your certificate of registration" />
          )}
          {needs.has('premises_photo') && (
            <Upload applicationId={application.id} kind="PREMISES_PHOTO" done={have.has('PREMISES_PHOTO')}
              title="A photo of where you trade"
              note="A stall, a shop, a table. Optional, but it helps customers recognise you." />
          )}
          {needs.has('property_photos') && (
            <Upload applicationId={application.id} kind="PROPERTY_PHOTO" done={have.has('PROPERTY_PHOTO')}
              title="Photos of the rooms" />
          )}
          {/* Offered to everybody, required of nobody. A woman selling bread
              from her kitchen has no logo and is not going to commission one
              to sell bread. */}
          {needs.has('logo') && (
            <Upload applicationId={application.id} kind="LOGO" done={have.has('LOGO')}
              title="Your logo or a picture (optional)"
              note="Not required. This is what customers see first in the directory - a clear photo of what you sell works just as well as a designed logo." />
          )}
        </div>

        {/* ---------------------------------------------------- submit */}
        <div className="mt-12 border-t border-rule pt-8">
          <Say state={submitState} />
          <form action={send}>
            <input type="hidden" name="applicationId" value={application.id} />
            <Submit
              label={readiness.canSubmit ? 'Send it to Musuwo' : 'Not ready yet'}
              disabled={!readiness.canSubmit}
              className="w-full bg-accent px-8 py-5 font-mono text-small font-bold uppercase tracking-label text-white transition-colors hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
            />
          </form>
          <p className="mt-4 max-w-measure text-small text-ink-faint">
            {readiness.canSubmit
              ? 'A person at Musuwo reads every application. Sending it does not put you online - approval does.'
              : `Still needed: ${readiness.missing.map((m) => m.label).join(', ')}.`}
          </p>
        </div>
      </div>

      <Checklist readiness={readiness} />
    </div>
  )
}
