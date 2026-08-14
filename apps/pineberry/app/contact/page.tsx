import type { Metadata } from 'next'
import { BRANDS, brandHref } from '@pineberry/ui'
import { SiteNav } from '@/app/components/SiteNav'
import { PageHeader } from '@/app/components/PageHeader'
import { Colophon } from '@/app/components/Colophon'
import { SITE } from '@/app/data/site'

export const metadata: Metadata = {
  title: 'Contact',
  description:
    'How to reach Pineberry Holdings, and how to reach each of the four companies in the group directly.',
}

export default function ContactPage() {
  return (
    <>
      <SiteNav />
      <main>
        <PageHeader
          eyebrow="Contact"
          title="Who to talk to"
          intro="For anything to do with a specific business — a car, a delivery, a repair, an order — go straight to that company. It is faster, and they are the ones who can actually help."
        />

        {/* Company-first, holding-company-second. A parent company's contact
            page that buries the operating businesses sends every customer
            enquiry to the wrong inbox. */}
        <section className="border-b border-rule">
          <div className="mx-auto max-w-[80rem] px-gutter py-section">
            <h2 className="text-h2">The companies</h2>

            <ul className="mt-12 border-t border-ink">
              {BRANDS.map((brand) => (
                <li key={brand.slug} className="border-b border-rule">
                  <a
                    href={brandHref(brand)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex flex-wrap items-center justify-between gap-6 py-7"
                  >
                    <span className="flex items-center gap-4">
                      <span
                        aria-hidden
                        className="h-7 w-1 shrink-0"
                        style={{ backgroundColor: brand.palette.accent }}
                      />
                      <span>
                        <span className="block font-display text-h3 transition-colors group-hover:text-accent">
                          {brand.fullName ?? brand.name}
                        </span>
                        <span className="mt-1 block text-ink-soft">
                          {brand.line}
                        </span>
                      </span>
                    </span>
                    <span className="font-mono text-micro uppercase tracking-label text-accent">
                      Visit site ↗
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-b border-rule bg-paper-sunk">
          <div className="mx-auto max-w-[80rem] px-gutter py-section">
            <h2 className="text-h2">The group</h2>
            <p className="mt-8 max-w-measure text-lead text-ink-soft">
              For anything about {SITE.name} itself — partnerships, suppliers,
              or a business you think belongs in the group.
            </p>

            {/* The holding company's own details are still placeholders and
                are marked as such rather than shown as if real. */}
            <div className="mt-10 max-w-2xl border-l-4 border-support bg-paper p-8">
              <h3 className="text-h4 font-medium">
                Group contact details still to be set
              </h3>
              <p className="mt-4 text-ink-soft">
                The address and phone number in{' '}
                <code className="font-mono text-small">app/data/site.ts</code>{' '}
                are placeholders — the phone number there is literally
                +263&nbsp;00&nbsp;000&nbsp;0000, and the head office city is
                marked unconfirmed. Nothing is published here until they are
                real.
              </p>
              <p className="mt-4 text-ink-soft">
                Until then, the fastest route to anyone in the group is through
                whichever company you actually need.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Colophon />
    </>
  )
}
