import type { Metadata } from 'next'
import { Reveal } from '@pineberry/ui'
import { PageHeader } from '@/app/components/PageHeader'
import { SITE, REASONS, yearsTrading } from '@/app/data/site'

export const metadata: Metadata = {
  title: 'About',
  description:
    'Speed Motor Engineering has been doing engine, gearbox and suspension work since 1996. Part of Pineberry Holdings.',
}

export default function AboutPage() {
  return (
    <main>
      <PageHeader
        eyebrow="About"
        title={`${yearsTrading()} years of the heavy jobs`}
        intro={`${SITE.fullName} has been trading since ${SITE.founded}. It is the oldest business in the Pineberry group by a long way.`}
      />

      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h2 className="text-h2">The short version</h2>
              <div className="mt-8 max-w-measure space-y-5 text-lead text-ink-soft">
                <p>
                  A shop that opened in {SITE.founded} and has been pulling
                  engines apart ever since. Most garages will do a service and
                  send you on your way. Fewer will take a head off, measure it
                  properly, and tell you what it actually needs.
                </p>
                <p>
                  That is the work this place is built around, and it is why
                  cars turn up here after somewhere else has had a go.
                </p>
                <p>{SITE.fullName} is part of {SITE.parent}.</p>
              </div>
            </div>

            <dl className="lg:col-span-5">
              <div className="border-t border-ink pt-2">
                <div className="spec">
                  <dt>Established</dt>
                  <dd>{SITE.founded}</dd>
                </div>
                <div className="spec">
                  <dt>Years trading</dt>
                  <dd>{yearsTrading()}</dd>
                </div>
                <div className="spec">
                  <dt>Based</dt>
                  <dd>{SITE.city ?? SITE.country}</dd>
                </div>
                <div className="spec">
                  <dt>Group</dt>
                  <dd>{SITE.parent}</dd>
                </div>
              </div>
            </dl>
          </div>
        </div>
      </section>

      {/* The team section from the old site is deliberately absent — see the
          note in app/data/site.ts. Four placeholder names is not a team. */}
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

          <p className="mt-16 max-w-measure text-ink-faint">
            The mechanics who do this work are not listed on the site yet.
            Send us names, roles and photographs and they go up — the previous
            site listed four invented people, and none of them were carried
            over.
          </p>
        </div>
      </section>
    </main>
  )
}
