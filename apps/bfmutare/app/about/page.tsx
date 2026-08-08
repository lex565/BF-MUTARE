import type { Metadata } from 'next'
import Image from 'next/image'
import { Reveal } from '@pineberry/ui'
import { PageHeader } from '@/app/components/PageHeader'
import { Partnership } from '@/app/components/Partnership'
import { SITE, STATS } from '@/app/data/site'
import { GOALS } from '@/app/data/goals'

export const metadata: Metadata = {
  title: 'About',
  description:
    'BF Mutare imports vehicles from Japan to order, out of Mutare in Manicaland, Zimbabwe.',
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
        intro={`${SITE.name} imports vehicles from Japan to order, out of Mutare in Manicaland. You tell us the model, the budget and the timeline — we handle everything between the auction floor and your driveway.`}
      />

      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <h2 className="text-h2">The short version</h2>
              <div className="mt-8 max-w-measure space-y-5 text-ink-soft">
                <p>
                  We have been importing and delivering vehicles for years
                  before this website existed. The photographs on this site are
                  a fraction of the cars that have gone through our hands.
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
                    Sourced from
                  </dt>
                  <dd className="mt-2 font-display text-h4 font-bold">Japan</dd>
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
              <Reveal from="up" className="relative aspect-16/11 w-[88%]">
                <Image
                  src="/featured/impreza-silver-02.jpg"
                  alt="A silver Subaru Impreza parked on a Mutare high street"
                  fill
                  sizes="(max-width: 1024px) 88vw, 46vw"
                  className="object-cover"
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
                className="bg-paper p-8 lg:p-10"
              >
                <span className="font-mono text-micro uppercase tracking-label text-accent">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-6 text-h4 font-semibold">{goal.title}</h3>
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
