import { SITE, mapLink, whatsappLink } from '@/app/data/site'
import { Social } from '@/app/components/Social'

/**
 * WhatsApp-first, deliberately. A contact form on a static site needs a third
 * party to receive it, and in this market a message thread the seller can
 * answer from their phone converts better than an email nobody checks.
 */
export function Contact() {
  return (
    <section
      id="contact"
      className="border-t border-rule bg-paper-sunk"
    >
      <div className="mx-auto max-w-[86rem] px-gutter py-section">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <h2 className="text-h2">Reach us</h2>
            <a
              href={whatsappLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-10 inline-flex items-center gap-3 bg-accent px-8 py-4 font-mono text-small font-bold uppercase tracking-label text-paper transition-colors duration-200 hover:bg-accent-deep"
            >
              WhatsApp {SITE.phoneDisplay}
            </a>

            <div className="mt-12">
              <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
                Follow us
              </p>
              <Social className="mt-4" />
            </div>
          </div>

          <div className="lg:col-span-5">
            <dl className="divide-y divide-rule border-y border-rule">
              <div className="flex justify-between gap-6 py-5">
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Phone
                </dt>
                <dd className="text-right">
                  <a
                    href={`tel:${SITE.phoneDisplay.replace(/\s/g, '')}`}
                    className="transition-colors hover:text-accent"
                  >
                    {SITE.phoneDisplay}
                  </a>
                </dd>
              </div>
              <div className="flex justify-between gap-6 py-5">
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Email
                </dt>
                <dd className="text-right">
                  <a
                    href={`mailto:${SITE.email}`}
                    className="transition-colors hover:text-accent"
                  >
                    {SITE.email}
                  </a>
                </dd>
              </div>
              <div className="flex justify-between gap-6 py-5">
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Where
                </dt>
                <dd className="text-right">
                  <a
                    href={mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="transition-colors hover:text-accent"
                  >
                    {SITE.address.street}
                    <br />
                    {SITE.address.city}, {SITE.address.country}
                    <span className="ml-1 text-ink-faint">↗</span>
                  </a>
                </dd>
              </div>
              {SITE.hours.map((slot) => (
                <div key={slot.days} className="flex justify-between gap-6 py-5">
                  <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                    {slot.days}
                  </dt>
                  <dd className="text-right font-mono text-small text-ink-soft">
                    {slot.time}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  )
}
