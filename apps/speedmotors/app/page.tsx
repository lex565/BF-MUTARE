import Link from 'next/link'
import { Reveal } from '@pineberry/ui'
import { SITE, SERVICES, REASONS, yearsTrading } from '@/app/data/site'

export default function HomePage() {
  return (
    <main>
      {/* Hero. No stock workshop photograph and no borrowed video: the old
          site's hero was a 27MB clip of somebody else's garage. Until there
          are photographs of this workshop, type and a hairline grid carry it,
          which is honest and also suits a service-sheet aesthetic. */}
      <section className="relative overflow-hidden border-b border-rule">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.35]"
          style={{
            backgroundImage:
              'linear-gradient(var(--color-rule) 1px, transparent 1px), linear-gradient(90deg, var(--color-rule) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
            maskImage:
              'radial-gradient(120% 90% at 12% 8%, #000 0%, transparent 72%)',
          }}
        />

        <div className="mx-auto max-w-[86rem] px-gutter pb-20 pt-20 md:pb-28 md:pt-28">
          <p className="font-mono text-micro uppercase tracking-label text-accent">
            {SITE.country} · Est. {SITE.founded}
          </p>

          <h1 className="mt-8 max-w-[17ch] text-mega leading-[0.9]">
            Engine, gearbox,{' '}
            <span className="text-accent">suspension</span>
          </h1>

          <p className="mt-9 max-w-[52ch] text-lead text-ink-soft">
            {SITE.fullName} is a working repair shop, not a parts counter. The
            heavy jobs — overhauls, rebuilds, the fault nobody else could find —
            are the ones it was built for.
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link
              href="/services"
              className="bg-accent px-8 py-4 font-mono text-small font-bold uppercase tracking-label text-paper transition-colors duration-200 hover:bg-accent-deep"
            >
              What we do
            </Link>
            <Link
              href="/contact"
              className="group inline-flex items-center gap-3 border border-ink px-8 py-4 font-mono text-small uppercase tracking-label transition-colors duration-200 hover:bg-ink hover:text-paper"
            >
              Book it in
              <span
                aria-hidden
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>

          <dl className="mt-16 grid max-w-2xl grid-cols-2 gap-x-12 sm:grid-cols-3">
            <div className="spec flex-col items-start gap-1">
              <dt>Trading since</dt>
              <dd className="font-display text-h3 font-bold">{SITE.founded}</dd>
            </div>
            <div className="spec flex-col items-start gap-1">
              <dt>Years</dt>
              <dd className="font-display text-h3 font-bold text-accent">
                {yearsTrading()}
              </dd>
            </div>
            <div className="spec flex-col items-start gap-1">
              <dt>Services</dt>
              <dd className="font-display text-h3 font-bold">
                {SERVICES.length}
              </dd>
            </div>
          </dl>
        </div>
      </section>

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
