import Image from 'next/image'
import Link from 'next/link'
import { Reveal } from '@pineberry/ui'
import { SITE, PRINCIPLES, CATEGORIES } from '@/app/data/site'

export default function HomePage() {
  return (
    <main>
      {/* Hero. The diaspora line leads because it is the one thing no
          supermarket in Mutare offers, and because it is the reason someone in
          Leeds or Johannesburg would ever land on this page.

          The photograph is the client's own. It earns its place rather than
          being decoration: a woman with a suitcase in a Zimbabwean courtyard
          reads as travelling and coming home, which is precisely the diaspora
          relationship this business exists to serve. A supermarket aisle would
          have said "shop"; this says "family". */}
      {/* Full-bleed photograph with the type over it.

          The source PNG is used uncompressed — next/image resizes it and
          serves AVIF or WebP per request, so the original stays full quality
          on disk without a 2.4MB download ever reaching a phone.

          Legibility is handled by inverting the type rather than by bleaching
          the photograph. An earlier attempt kept the dark-on-cream palette and
          needed a scrim heavy enough to wash the image out to do it. Cream
          type over a warm dark gradient reads cleanly and leaves the picture
          intact — and the gradient is weighted to the bottom-left, where the
          courtyard floor is the quietest part of the frame. */}
      <section className="relative isolate border-b border-rule">
        <div className="absolute inset-0 -z-20">
          <Image
            src="/hero/courtyard.png"
            alt="A traveller arriving with a suitcase at a Zimbabwean courtyard under jacaranda blossom"
            fill
            priority
            quality={90}
            sizes="100vw"
            className="object-cover object-[38%_46%]"
          />
        </div>

        {/* Warm near-black, not the brand's dark green: green over a golden-
            hour photograph turns the whole frame to mud. And kept light —
            a first pass at 0.92/0.24 crushed the picture into a flat wash,
            which defeats the point of having one. Just enough under the type,
            almost nothing at the top. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_top,rgba(26,16,8,0.80)_0%,rgba(26,16,8,0.55)_28%,rgba(26,16,8,0.22)_58%,rgba(26,16,8,0.04)_100%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgba(26,16,8,0.38)_0%,rgba(26,16,8,0.10)_46%,transparent_72%)]"
        />

        <div className="relative mx-auto flex min-h-[34rem] max-w-[86rem] flex-col justify-end px-gutter pb-20 pt-28 md:min-h-[42rem] md:pb-24">
          <p className="chip w-fit border-white/40 text-white/85">
            Mutare · since {SITE.founded}
          </p>

          <h1 className="mt-8 max-w-[15ch] text-mega leading-[0.94] text-white">
            The shopping gets{' '}
            <span className="text-accent">done</span>, wherever you are.
          </h1>

          <p className="mt-8 max-w-[50ch] text-lead text-white/90">
            Groceries and household goods in Mutare, with same-day local
            delivery. And if you are abroad, you can buy the actual goods for
            your family here — not send money and hope.
          </p>

          <div className="mt-11 flex flex-wrap items-center gap-4">
            <Link
              href="/diaspora"
              className="bg-accent px-8 py-4 font-mono text-small font-bold uppercase tracking-label text-white transition-colors duration-200 hover:bg-accent-deep"
            >
              Shopping from abroad
            </Link>
            <Link
              href="/shop"
              className="group inline-flex items-center gap-3 border border-white/60 px-8 py-4 font-mono text-small uppercase tracking-label text-white transition-colors duration-200 hover:bg-white hover:text-ink"
            >
              What we stock
              <span
                aria-hidden
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* The three principles, as the profile states them. */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <h2 className="max-w-[20ch] text-h1">
            Three things we decide everything by
          </h2>

          <ul className="mt-16 grid grid-cols-1 gap-px bg-rule md:grid-cols-3">
            {PRINCIPLES.map((principle, index) => (
              <Reveal
                key={principle.title}
                as="li"
                from="up"
                delay={index * 0.07}
                className="bg-paper p-8 lg:p-10"
              >
                <span
                  aria-hidden
                  className="block h-1 w-10"
                  style={{
                    backgroundColor:
                      index === 1
                        ? 'var(--color-accent)'
                        : 'var(--color-support)',
                  }}
                />
                <h3 className="mt-6 text-h4 font-bold">{principle.title}</h3>
                <p className="mt-3 text-ink-soft">{principle.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* A taste of the catalogue, with the full list one click away. */}
      <section className="border-b border-rule bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <h2 className="max-w-[16ch] text-h1">On the shelves</h2>
            <Link
              href="/shop"
              className="group inline-flex items-center gap-2 border-b border-accent pb-1 font-mono text-micro uppercase tracking-label transition-colors hover:text-accent"
            >
              All categories
              <span
                aria-hidden
                className="transition-transform duration-300 group-hover:translate-x-1"
              >
                →
              </span>
            </Link>
          </div>

          <ul className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {CATEGORIES.slice(0, 3).map((category, index) => (
              <Reveal
                key={category.title}
                as="li"
                from="up"
                delay={index * 0.07}
                className="border border-rule bg-paper p-8"
              >
                <h3 className="text-h4 font-bold">{category.title}</h3>
                <p className="mt-3 text-ink-soft">{category.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
