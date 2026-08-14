import type { Metadata } from 'next'
import { PARENT, parentHref } from '@pineberry/ui'
import { PageHeader } from '@/app/components/PageHeader'
import { SITE, LEGAL } from '@/app/data/site'

export const metadata: Metadata = {
  title: 'Visit',
  description:
    'Where to find 420 Liquor Store in Mutare, Zimbabwe. Over 18s only.',
}

export default function ContactPage() {
  const hasContact = SITE.phoneDisplay || SITE.email || SITE.street

  return (
    <main>
      <PageHeader
        eyebrow="Visit"
        title="Come at twenty past four"
        intro="That is when the room is best. Any other time works too."
      />

      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          {hasContact ? (
            <dl className="max-w-2xl divide-y divide-rule border-y border-rule">
              {SITE.street && (
                <div className="flex justify-between gap-6 py-5">
                  <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                    Where
                  </dt>
                  <dd className="text-right">{SITE.street}</dd>
                </div>
              )}
              {SITE.phoneDisplay && (
                <div className="flex justify-between gap-6 py-5">
                  <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                    Phone
                  </dt>
                  <dd>{SITE.phoneDisplay}</dd>
                </div>
              )}
            </dl>
          ) : (
            /* The earlier HTML draft listed +263 20 420 4200 — a number
               patterned on the brand name rather than a real line — and an
               email on a domain that may not exist. Neither was carried over. */
            <div className="max-w-2xl border-l-4 border-accent bg-paper-sunk p-8">
              <h2 className="text-h3">Address and phone still to come</h2>
              <p className="mt-4 text-lead text-ink-soft">
                {SITE.fullName} trades from {SITE.city}, {SITE.country}. The
                street address, phone number and email are not published here
                yet — the brand document does not contain them, and the earlier
                draft of this site used a placeholder number patterned on the
                brand name.
              </p>
              <p className="mt-4 text-ink-soft">
                Send the real ones through and they go up here, in the footer,
                and on a map.
              </p>
            </div>
          )}

          <div className="mt-14 max-w-2xl">
            <p className="stamp">{SITE.minimumAge}+ only</p>
            <p className="mt-5 text-small leading-relaxed text-ink-soft">
              {LEGAL.licensed} {LEGAL.responsible}
            </p>
          </div>

          <div className="mt-16 max-w-2xl border-t border-rule pt-8">
            <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
              Part of {PARENT.name}
            </p>
            <p className="mt-4 text-ink-soft">
              {SITE.fullName} is one of four businesses in the group.{' '}
              <a
                href={parentHref()}
                className="border-b border-accent text-accent transition-colors hover:text-ink"
              >
                See the rest of {PARENT.name} ↗
              </a>
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
