import Image from 'next/image'
import Link from 'next/link'
import { Reveal } from '@pineberry/ui'
import { FEATURED } from '@/app/data/deliveries'
import { DeliveryCard } from './DeliveryCard'

/**
 * The rest of the home page: a short statement of what the company is, then a
 * taste of the deliveries, then out. Home ends here and sends you to a page —
 * it is not a container for the whole site.
 */
export function HomeSummary() {
  const preview = FEATURED.slice(0, 3)

  return (
    <>
      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h2 className="max-w-[16ch] text-h1">
                Importing a car should not feel like a gamble
              </h2>
              <div className="mt-8 max-w-measure space-y-5 text-lead text-ink-soft">
                <p>
                  You tell us the model, the budget and the timeline. We source
                  it in Japan, ship it, clear it through the port, handle the
                  duty, and hand you the keys and the file.
                </p>
                <p>
                  You are buying from people you can go and stand in front of in
                  Mutare, not a listing on the internet.
                </p>
              </div>
              <Link
                href="/about"
                className="group mt-10 inline-flex items-center gap-3 border-b border-accent pb-1 font-mono text-micro uppercase tracking-label transition-colors hover:text-accent"
              >
                More about us
                <span
                  aria-hidden
                  className="transition-transform duration-300 ease-[var(--ease-out-quint)] group-hover:translate-x-1"
                >
                  →
                </span>
              </Link>
            </div>

            <Reveal from="up" className="relative aspect-4/5 lg:col-span-5">
              <Image
                src="/partnership/japan-visit-01.jpeg"
                alt="The BF Mutare team with visiting colleagues from Japan at the Mutare office"
                fill
                sizes="(max-width: 1024px) 100vw, 40vw"
                className="object-cover"
              />
            </Reveal>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="text-h2">Recently delivered</h2>
            <Link
              href="/deliveries"
              className="group font-mono text-micro uppercase tracking-label text-ink-soft transition-colors hover:text-accent"
            >
              See all deliveries
              <span
                aria-hidden
                className="ml-2 inline-block transition-transform duration-300 ease-[var(--ease-out-quint)] group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {preview.map((vehicle, index) => (
              <Reveal
                key={vehicle.slug}
                as="div"
                from="up"
                delay={index * 0.08}
                className="h-full"
              >
                <DeliveryCard vehicle={vehicle} />
              </Reveal>
            ))}
          </div>
        </div>
      </section>
    </>
  )
}
