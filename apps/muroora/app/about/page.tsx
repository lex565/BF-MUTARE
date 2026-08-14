import type { Metadata } from 'next'
import { Reveal } from '@pineberry/ui'
import { PageHeader } from '@/app/components/PageHeader'
import { SITE, PRINCIPLES } from '@/app/data/site'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Muroora Mart is a neighbourhood retailer in Mutare combining a storefront, an online catalogue, local delivery and a diaspora shopping service.',
}

const VALUES = [
  {
    title: 'Reliability',
    body: 'Customers depend on consistent product availability and service delivery.',
  },
  {
    title: 'Integrity',
    body: 'Transparent pricing, honest communication, and ethical supplier relationships.',
  },
  {
    title: 'Inclusivity',
    body: 'Services designed to serve all community members, regardless of income level.',
  },
  {
    title: 'Innovation',
    body: 'Continuous improvement of the digital platform and how delivery actually works.',
  },
  {
    title: 'Community',
    body: 'Every operational decision reflects a commitment to Mutare’s wellbeing.',
  },
]

export default function AboutPage() {
  return (
    <main>
      <PageHeader
        eyebrow="About"
        title="The relative who provides"
        intro={SITE.nameMeaning}
      />

      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h2 className="text-h2">What we are</h2>
              <div className="mt-8 max-w-measure space-y-5 text-lead text-ink-soft">
                <p>
                  A neighbourhood retailer in {SITE.city} that sits between the
                  way shops here have always worked and the way people buy now.
                  There is a storefront, an online catalogue, and delivery — and
                  you can use whichever of the three suits the day you are
                  having.
                </p>
                <p>
                  The name is the whole idea. A <em>muroora</em> is the family
                  member who supports and provides for the household. That is
                  the job we are trying to do for the households we serve, and
                  for the families abroad who are trying to do it from a
                  distance.
                </p>
                <p>
                  {SITE.name} is part of {SITE.parent}.
                </p>
              </div>
            </div>

            <dl className="lg:col-span-5">
              <div className="grid grid-cols-2 gap-8 border-t border-rule pt-8">
                <div>
                  <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                    Based
                  </dt>
                  <dd className="mt-2 text-h4 font-bold">
                    {SITE.city}, {SITE.country}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                    Trading since
                  </dt>
                  <dd className="mt-2 text-h4 font-bold text-accent">
                    {SITE.founded}
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                    Delivery
                  </dt>
                  <dd className="mt-2 text-h4 font-bold">Same day</dd>
                </div>
                <div>
                  <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                    Serving
                  </dt>
                  <dd className="mt-2 text-h4 font-bold">
                    Local &amp; diaspora
                  </dd>
                </div>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section className="border-b border-rule bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <h2 className="max-w-[18ch] text-h1">What we hold to</h2>
          <ul className="mt-14 grid grid-cols-1 gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((value, index) => (
              <Reveal
                key={value.title}
                as="li"
                from="up"
                delay={(index % 3) * 0.06}
                className="bg-paper-sunk p-8"
              >
                <h3 className="text-h4 font-bold text-support">
                  {value.title}
                </h3>
                <p className="mt-3 text-ink-soft">{value.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <h2 className="max-w-[20ch] text-h1">And how we decide</h2>
          <ul className="mt-14 grid grid-cols-1 gap-10 md:grid-cols-3">
            {PRINCIPLES.map((principle) => (
              <li key={principle.title} className="border-t border-ink pt-6">
                <h3 className="text-h4 font-bold">{principle.title}</h3>
                <p className="mt-3 text-ink-soft">{principle.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
