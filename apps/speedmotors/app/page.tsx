import Link from 'next/link'
import { Reveal } from '@pineberry/ui'
import { Hero } from '@/app/components/Hero'
import { SERVICES, REASONS } from '@/app/data/site'

export default function HomePage() {
  return (
    <main>
      <Hero />

      {/* Services, as a list rather than as cards. A workshop's capability
          list should read like a rate card, not like a feature grid. */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="max-w-[16ch] text-h1">What comes through the door</h2>
            <Link
              href="/services"
              className="group inline-flex items-center gap-2 border-b border-accent pb-1 font-mono text-micro uppercase tracking-label text-accent"
            >
              All services
              <span
                aria-hidden
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>

          <ol className="mt-14 border-t border-ink">
            {SERVICES.slice(0, 4).map((service, index) => (
              <Reveal
                key={service.title}
                as="li"
                from="up"
                delay={index * 0.05}
                className="group border-b border-rule"
              >
                <div className="grid grid-cols-1 gap-x-8 gap-y-3 py-7 transition-colors duration-300 group-hover:bg-paper-sunk lg:grid-cols-12">
                  <span
                    aria-hidden
                    className="font-mono text-micro tracking-label text-ink-faint lg:col-span-1"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h3 className="text-h4 font-semibold lg:col-span-4">
                    {service.title}
                  </h3>
                  <p className="max-w-measure text-ink-soft lg:col-span-7">
                    {service.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <h2 className="max-w-[18ch] text-h1">Why here</h2>
          <ul className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-3">
            {REASONS.map((reason, index) => (
              <Reveal
                key={reason.title}
                as="li"
                from="up"
                delay={index * 0.07}
                className="border-t-2 border-accent pt-6"
              >
                <h3 className="text-h4 font-semibold">{reason.title}</h3>
                <p className="mt-3 text-ink-soft">{reason.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
