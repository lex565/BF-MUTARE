import type { Metadata } from 'next'
import Image from 'next/image'
import { Reveal } from '@pineberry/ui'
import { PageHeader } from '@/app/components/PageHeader'
import { Partnership } from '@/app/components/Partnership'
import { Services } from '@/app/components/Services'
import { SITE, STATS } from '@/app/data/site'
import { GOALS } from '@/app/data/goals'

export const metadata: Metadata = {
  title: 'About',
  description:
    'BF Mutare imports vehicles to order, based in Mutare in Manicaland and operating right around Zimbabwe.',
}

export default function AboutPage() {
  const years = STATS.operatingSince
    ? new Date().getFullYear() - STATS.operatingSince
    : null

  return (
    <main>
      <PageHeader
        eyebrow="About"
        title="Based in Mutare, not a call centre"
        intro={`${SITE.name} is based in Mutare and operates right around Zimbabwe. You tell us the model, the budget and the timeline — we source it, and we handle everything between the auction floor and your driveway.`}
      />

      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <h2 className="text-h2">The short version</h2>
              <div className="mt-8 max-w-measure space-y-5 text-lead text-ink-soft">
                <p>
                  We have been importing and delivering vehicles for years
                  before this website existed. The photographs on this site are
                  a fraction of the cars that have gone through our hands.
                </p>
                <p>
                  The office is in Mutare, but the work is not. Cars go out to
                  owners right around Zimbabwe, and we source them from wherever
                  the right vehicle at the right price happens to be.
                </p>
                <p>
                  We photograph our own vehicles. Every image here is a real car
                  on a real Mutare street on its way to a real owner — which is
                  also why some of them have dust on the paint.
                </p>
                <p>
                  {SITE.name} is part of {SITE.parent}.
                </p>
              </div>

              <dl className="mt-12 grid grid-cols-2 gap-x-8 gap-y-8 border-t border-rule pt-8">
                <div>
                  <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                    Based
                  </dt>
                  <dd className="mt-2 font-display text-h4 font-bold">
                    Mutare, ZW
                  </dd>
                </div>
                <div>
                  <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                    Delivering
                  </dt>
                  <dd className="mt-2 font-display text-h4 font-bold">
                    Countrywide
                  </dd>
                </div>
                <div>
                  {/* Was "Sourced from — Japan", which is not true: the client
                      sources from more than one market. Left as the neutral
                      word until they say which markets they want named, since
                      naming the actual countries would be stronger than this. */}
                  <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                    Sourced
                  </dt>
                  <dd className="mt-2 font-display text-h4 font-bold">
                    Overseas
                  </dd>
                </div>
                {/* Only rendered once a real founding year is set — see
                    STATS.operatingSince. Guessing it would either flatter or
                    undersell a business that has been running a long time. */}
                {years !== null && (
                  <div>
                    <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                      Trading
                    </dt>
                    <dd className="mt-2 font-display text-h4 font-bold text-accent">
                      {years} years
                    </dd>
                  </div>
                )}
                {STATS.totalDelivered !== null && (
                  <div>
                    <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                      Delivered
                    </dt>
                    <dd className="mt-2 font-display text-h4 font-bold text-accent">
                      {STATS.totalDelivered.toLocaleString('en-US')}
                    </dd>
                  </div>
                )}
              </dl>
            </div>

            <div className="relative lg:col-span-7">
              {/* Exterior and interior are the same car — the blue X1 on plate
                  AHN 6714. They were a Subaru exterior next to a BMW interior,
                  which reads as stock photography the moment anyone notices. */}
              <Reveal from="up" className="relative aspect-16/11 w-[88%]">
                <Image
                  src="/featured/bmw-x1-01.jpg"
                  alt="A blue BMW X1 xDrive parked on a Mutare street"
                  fill
                  sizes="(max-width: 1024px) 88vw, 46vw"
                  /* Shot portrait, shown landscape, so the crop is doing real
                     work. Held slightly above centre to keep the grille and
                     the front wheel in frame instead of the gravel. */
                  className="object-cover object-[50%_42%]"
                />
              </Reveal>
              <Reveal
                from="up"
                delay={0.12}
                className="relative -mt-[18%] ml-auto aspect-3/4 w-[46%] border-4 border-paper"
              >
                <Image
                  src="/featured/bmw-x1-interior.jpg"
                  alt="Interior of a BMW X1, right-hand drive"
                  fill
                  sizes="(max-width: 1024px) 46vw, 24vw"
                  className="object-cover"
                />
              </Reveal>
            </div>
          </div>
        </div>
      </section>

      {/* What we do now sits before what we are working towards — concrete
          before aspirational, or the goals read as a substitute for services
          rather than as an addition to them. */}
      <Services />

      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <h2 className="max-w-[16ch] text-h1">What we are working towards</h2>

          <ol className="mt-16 grid grid-cols-1 gap-px bg-rule md:grid-cols-2">
            {GOALS.map((goal, index) => (
              <Reveal
                key={goal.title}
                as="li"
                from="up"
                delay={index * 0.06}
                className="group bg-paper p-8 transition-colors duration-300 hover:bg-paper-sunk lg:p-10"
              >
                {/* Same numeral treatment as the services list — see
                    `.numeral` in globals.css. */}
                <div className="flex items-center gap-4">
                  <span aria-hidden className="numeral text-h2">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    aria-hidden
                    className="h-px flex-1 bg-rule transition-colors duration-300 group-hover:bg-accent"
                  />
                </div>
                <h3 className="mt-7 text-h4 font-semibold">{goal.title}</h3>
                <p className="mt-3 max-w-measure text-ink-soft">{goal.body}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <Partnership />
    </main>
  )
}
