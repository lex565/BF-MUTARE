import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'

import { ApplicationForm, ChooseProviderType } from './ApplyForm'
import { currentUser } from '@/lib/auth'
import { listDocuments } from '@/lib/platform/documents'
import {
  acceptedAddressEvidence,
  myDraft,
  readiness,
} from '@/lib/platform/registration'

export const metadata: Metadata = { title: 'List your business' }
export const dynamic = 'force-dynamic'

/**
 * Registering a business on Musuwo.
 *
 * SIGNING IN COMES FIRST, and that is not bureaucracy: an application has to
 * belong to somebody who can be written back to, and a draft has to survive
 * being closed. The redirect carries `next` so they land back here rather than
 * on their account page wondering where the form went.
 */
const CATEGORIES = [
  { value: 'RETAIL', label: 'Shop or retail' },
  { value: 'FOOD', label: 'Food, restaurant or takeaway' },
  { value: 'ACCOMMODATION', label: 'Accommodation or rooms' },
  { value: 'SERVICE', label: 'Services' },
  { value: 'EDUCATION', label: 'Tutoring or education' },
  { value: 'BEAUTY', label: 'Beauty or personal care' },
  { value: 'AUTOMOTIVE', label: 'Motoring' },
  { value: 'HOME_SERVICES', label: 'Home services' },
  { value: 'ELECTRONICS', label: 'Electronics' },
  { value: 'BOOKS', label: 'Books or stationery' },
  { value: 'OTHER', label: 'Something else' },
]

export default async function ApplyPage() {
  const user = await currentUser()
  if (!user) redirect('/login?next=/marketplace/apply')

  const draft = await myDraft(user.id)

  return (
    <main className="mx-auto max-w-[86rem] px-gutter py-12">
      <Link
        href="/marketplace"
        className="font-mono text-micro uppercase tracking-label text-support"
      >
        ← Musuwo directory
      </Link>

      <p className="mt-10 font-mono text-micro uppercase tracking-label text-accent">
        Musuwo for business
      </p>
      <h1 className="mt-3 max-w-[18ch] text-mega leading-none">
        {draft ? 'Your application' : 'Put your business on Musuwo'}
      </h1>
      <p className="mt-5 max-w-[55ch] text-lead text-ink-soft">
        {draft
          ? 'Fill in what you have. It saves as you go, and nothing is sent until you say so.'
          : 'Listing is free while Musuwo is new. You can start now and finish when you have your documents.'}
      </p>

      <div className="mt-12">
        {!draft || !draft.providerType ? (
          <ChooseProviderType />
        ) : (
          <ApplicationForm
            application={{
              id: draft.id,
              status: draft.status,
              businessName: draft.businessName,
              summary: draft.summary,
              kind: draft.kind,
              city: draft.city,
              contactPhone: draft.contactPhone,
              contactEmail: draft.contactEmail,
              whatsapp: draft.whatsapp,
              legalName: draft.legalName,
              idType: draft.idType,
              idNumber: draft.idNumber,
              residentialAddress: draft.residentialAddress,
              addressEvidenceType: draft.addressEvidenceType,
              operatingArea: draft.operatingArea,
              registrationNumber: draft.registrationNumber,
              note: draft.note,
              infoRequested: draft.infoRequested,
            }}
            readiness={await readiness(draft.id)}
            evidenceTypes={await acceptedAddressEvidence()}
            documentKinds={(await listDocuments(draft.id)).map((d) => d.kind)}
            categories={CATEGORIES}
          />
        )}
      </div>
    </main>
  )
}
