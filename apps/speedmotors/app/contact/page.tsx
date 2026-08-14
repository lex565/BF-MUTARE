import type { Metadata } from 'next'
import { PARENT, parentHref } from '@pineberry/ui'
import { PageHeader } from '@/app/components/PageHeader'
import { SITE } from '@/app/data/site'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'Book a car in with Speed Motor Engineering, or describe the fault and get a quote before work starts.',
}

export default function ContactPage() {
  const hasContact = SITE.phoneDisplay || SITE.email || SITE.whatsapp

  return (
    <main>
      <PageHeader
        eyebrow="Contact"
        title="Book it in"
        intro="Tell us the make, the model and what it is doing. A rattle, a smell, a warning light, a noise only on cold mornings — all of it helps."
      />

      <section>
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          {hasContact ? (
            <dl className="max-w-2xl border-t border-ink pt-2">
              {SITE.phoneDisplay && (
                <div className="spec">
                  <dt>Phone</dt>
                  <dd>{SITE.phoneDisplay}</dd>
                </div>
              )}
              {SITE.email && (
                <div className="spec">
                  <dt>Email</dt>
                  <dd>{SITE.email}</dd>
                </div>
              )}
            </dl>
          ) : (
            /* The previous site's WhatsApp button linked to
               wa.me/YOURPHONENUMBER — the placeholder shipped live. This page
               says what is missing instead of repeating that. */
            <div className="max-w-2xl border-l-4 border-support bg-paper-sunk p-8">
              <h2 className="text-h3 font-semibold">
                Phone number still to come
              </h2>
              <p className="mt-4 text-lead text-ink-soft">
                The workshop&rsquo;s phone number, WhatsApp line and address are
                not published here yet. The previous site had a WhatsApp button
                that pointed at the literal text
                &ldquo;YOURPHONENUMBER&rdquo;, so nothing was carried across
                from it.
              </p>
              <p className="mt-4 text-ink-soft">
                Send the real details through and they will appear here, in the
                footer, and as a WhatsApp button on every page.
              </p>
            </div>
          )}

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
