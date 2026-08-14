import type { Metadata } from 'next'
import { PageHeader } from '@/app/components/PageHeader'
import { Buying } from '@/app/components/Buying'
import { Contact } from '@/app/components/Contact'
import { FINANCE } from '@/app/data/site'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Talk to BF Mutare about importing a vehicle, and about spreading the cost over up to 24 months.',
}

export default function ContactPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Contact"
        title="Import your next car"
        intro="Message us with the model you want, or a photo of one you have seen. It reaches a person, not an inbox."
      >
        {/* The payment plan again, on the page the ribbon sends people to.
            Arriving here from that ribbon and not immediately seeing it would
            be the fastest way to lose the enquiry. */}
        <div className="mt-12 border-l-4 border-accent bg-paper-sunk p-8">
          <p className="font-display text-h2 font-bold uppercase leading-none text-accent">
            {FINANCE.headline}
          </p>
          <p className="mt-4 max-w-measure text-lead text-ink-soft">
            {FINANCE.support}
          </p>

          <dl className="mt-6 flex flex-wrap gap-x-12 gap-y-4">
            {FINANCE.depositFrom && (
              <div>
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Deposit
                </dt>
                <dd className="mt-1 font-mono text-small">
                  {FINANCE.depositFrom}
                </dd>
              </div>
            )}
            {FINANCE.eligibility && (
              <div>
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Eligibility
                </dt>
                <dd className="mt-1 font-mono text-small">
                  {FINANCE.eligibility}
                </dd>
              </div>
            )}
          </dl>

          {/* Terms are unconfirmed, so the page says so rather than implying
              detail that does not exist yet. Remove this once FINANCE.confirmed
              is true and the fields above are filled in. */}
          {!FINANCE.confirmed && (
            <p className="mt-6 max-w-measure font-mono text-micro uppercase tracking-label text-ink-faint">
              Ask us for the full terms — deposit, instalments and approval.
            </p>
          )}
        </div>
      </PageHeader>

      <Contact />
      <Buying />
    </main>
  )
}
