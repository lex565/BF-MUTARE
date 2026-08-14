import type { Metadata } from 'next'
import { Reveal } from '@pineberry/ui'
import { PageHeader } from '@/app/components/PageHeader'
import { SERVICES } from '@/app/data/site'

export const metadata: Metadata = {
  title: 'Services',
  description:
    'Engine and gearbox overhauls, suspension, brakes, clutch systems, hybrid vehicles, tune-ups and general servicing.',
}

export default function ServicesPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Services"
        title="Seven things we do"
        intro="Everything below is done in-house. If a job needs a specialist we do not have, we will say so rather than take the car apart and find out afterwards."
      />

      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <ol className="border-t border-ink">
            {SERVICES.map((service, index) => (
              <Reveal
                key={service.title}
                as="li"
                from="up"
                delay={Math.min(index, 4) * 0.05}
                className="group border-b border-rule"
              >
                <div className="grid grid-cols-1 gap-x-8 gap-y-3 py-8 transition-colors duration-300 group-hover:bg-paper-sunk lg:grid-cols-12">
                  <span
                    aria-hidden
                    className="font-mono text-micro tracking-label text-accent lg:col-span-1"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <h2 className="text-h3 font-semibold lg:col-span-4">
                    {service.title}
                  </h2>
                  <p className="max-w-measure text-lead text-ink-soft lg:col-span-7">
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
          <div className="max-w-measure">
            <h2 className="text-h2">On quotes</h2>
            <p className="mt-6 text-lead text-ink-soft">
              Prices are not listed here, and that is deliberate rather than
              evasive. An overhaul on a well-kept engine and an overhaul on one
              that has been run dry are not the same job, and quoting a number
              on a page before anyone has looked at the car would be a number
              we would have to take back.
            </p>
            <p className="mt-5 text-lead text-ink-soft">
              Bring it in or describe the fault, and you get a figure before
              work starts.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
