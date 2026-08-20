import type { Metadata } from 'next'
import { PARENT, parentHref } from '@pineberry/ui'
import { PageHeader } from '@/app/components/PageHeader'
import { SITE } from '@/app/data/site'
import { brand, isMuroora } from '@/lib/brand'

export const metadata: Metadata = {
  title: 'Contact',
  description: isMuroora
    ? 'How to reach Muroora Mart in Mutare about an order, a delivery, or shopping for family from abroad.'
    : 'How to reach Musuwo about an order, selling on the marketplace, or anything else.',
}

/**
 * Musuwo's own contact page.
 *
 * This route existed but was Muroora Mart's, on both deployments - so
 * musuwo.online/contact told a marketplace customer how to reach a grocer
 * about their vegetables, and gave them no way to reach Musuwo at all.
 *
 * The three addresses all land in one mailbox. Each is listed with what it is
 * for, because a bare list of three makes somebody guess, and the wrong guess
 * makes the answer slower.
 */
function MusuwoContact() {
  return (
    <main>
      <PageHeader
        eyebrow="Contact"
        title="Talk to Musuwo"
        intro="Musuwo is the platform local businesses sell through. If your question is about a specific order, the shop that sold it can usually answer faster - but we will always help."
      />

      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <dl className="max-w-2xl divide-y divide-rule border-y border-rule">
            {brand.contacts.map((contact) => (
              <div key={contact.address} className="py-6">
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  {contact.label}
                </dt>
                <dd className="mt-2">
                  <a
                    href={`mailto:${contact.address}`}
                    className="border-b border-accent text-lead text-support transition-colors hover:text-accent"
                  >
                    {contact.address}
                  </a>
                  <p className="mt-2 text-ink-soft">{contact.purpose}</p>
                </dd>
              </div>
            ))}
          </dl>

          <p className="mt-8 max-w-2xl text-small text-ink-faint">
            Musuwo is based in Mutare, Zimbabwe. We reply to email; there is no
            phone line yet, and publishing one nobody answers would be worse
            than saying so.
          </p>
        </div>
      </section>
    </main>
  )
}

export default function ContactPage() {
  if (!isMuroora) return <MusuwoContact />

  const hasAnyContact =
    SITE.whatsapp || SITE.phoneDisplay || SITE.email || SITE.street

  return (
    <main>
      <PageHeader
        eyebrow="Contact"
        title="Place an order"
        intro="Tell us what the household needs and where it is going. If you are ordering from abroad, say which town the delivery is for and who will receive it."
      />

      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          {hasAnyContact ? (
            <dl className="max-w-2xl divide-y divide-rule border-y border-rule">
              {SITE.phoneDisplay && (
                <div className="flex justify-between gap-6 py-5">
                  <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                    Phone
                  </dt>
                  <dd>{SITE.phoneDisplay}</dd>
                </div>
              )}
              {SITE.email && (
                <div className="flex justify-between gap-6 py-5">
                  <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                    Email
                  </dt>
                  <dd>{SITE.email}</dd>
                </div>
              )}
              <div className="flex justify-between gap-6 py-5">
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Where
                </dt>
                <dd className="text-right">
                  {SITE.street ?? `${SITE.city}, ${SITE.country}`}
                </dd>
              </div>
            </dl>
          ) : (
            /* No invented numbers. The company profile this site was built
               from gives the city and nothing else, so the page says exactly
               that and does not fake a contact card. */
            <div className="max-w-2xl border-l-4 border-accent bg-paper-sunk p-8">
              <h2 className="text-h3 font-bold">
                Contact details still to come
              </h2>
              <p className="mt-4 text-lead text-ink-soft">
                {SITE.name} trades from {SITE.city}, {SITE.country}. The phone
                number, WhatsApp line and email address are not published here
                yet - they were not in the company profile this site was built
                from, and a made-up number is worse than none.
              </p>
              <p className="mt-4 text-ink-soft">
                Send them through and they will appear on this page, in the
                footer, and as a WhatsApp button on every screen.
              </p>
            </div>
          )}

          <div className="mt-16 max-w-2xl border-t border-rule pt-8">
            <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
              Part of {PARENT.name}
            </p>
            <p className="mt-4 text-ink-soft">
              {SITE.name} is one of four businesses in the group.{' '}
              <a
                href={parentHref()}
                className="border-b border-accent text-support transition-colors hover:text-accent"
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
