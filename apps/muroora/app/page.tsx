import Link from 'next/link'
import { Reveal } from '@pineberry/ui'
import { SITE, PRINCIPLES, CATEGORIES } from '@/app/data/site'

export default function HomePage() {
  return (
    <main>
      {/* Hero. The diaspora line leads because it is the one thing no
          supermarket in Mutare offers, and because it is the reason someone in
          Leeds or Johannesburg would ever land on this page. */}
      <section className="relative overflow-hidden border-b border-rule">
        {/* A soft green field behind the type rather than a photograph. There
            are no shop photographs yet, and a stock supermarket aisle would be
            the most obviously borrowed image on the site. */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 opacity-[0.07]"
          style={{
            backgroundImage:
              'radial-gradient(circle at 18% 22%, var(--color-support) 0, transparent 42%), radial-gradient(circle at 84% 68%, var(--color-accent) 0, transparent 46%)',
          }}
        />

        <div className="mx-auto max-w-[86rem] px-gutter pb-20 pt-20 md:pb-28 md:pt-28">
          <p className="chip chip-live">Mutare · since {SITE.founded}</p>

          <h1 className="mt-8 max-w-[16ch] text-mega leading-[0.94]">
            The shopping gets{' '}
            <span className="text-accent">done</span>, wherever you are.
          </h1>

          <p className="mt-9 max-w-[52ch] text-lead text-ink-soft">
            Groceries and household goods in Mutare, with same-day local
            delivery. And if you are abroad, you can buy the actual goods for
            your family here — not send money and hope.
          </p>

          <div className="mt-12 flex flex-wrap items-center gap-4">
            <Link
              href="/diaspora"
              className="bg-accent px-8 py-4 font-mono text-small font-bold uppercase tracking-label text-paper transition-colors duration-200 hover:bg-accent-deep"
            >
              Shopping from abroad
            </Link>
            <Link
              href="/shop"
              className="group inline-flex items-center gap-3 border border-support px-8 py-4 font-mono text-small uppercase tracking-label text-support transition-colors duration-200 hover:bg-support hover:text-paper"
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
