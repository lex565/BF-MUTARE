import type { Metadata } from 'next'
import { Reveal } from '@pineberry/ui'
import { PageHeader } from '@/app/components/PageHeader'
import { CATEGORIES, SEGMENTS } from '@/app/data/site'

export const metadata: Metadata = {
  title: 'What we stock',
  description:
    'Groceries, packaged food, cleaning supplies, personal hygiene, kitchen supplies and daily-use household items, in Mutare.',
}

export default function ShopPage() {
  return (
    <main>
      <PageHeader
        eyebrow="What we stock"
        title="Everything a household actually runs out of"
        intro="Six categories covering the weekly shop. Stock comes from verified local and regional suppliers, and the live catalogue online reflects what is actually on the shelf."
      />

      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <ul className="grid grid-cols-1 gap-px bg-rule md:grid-cols-2 xl:grid-cols-3">
            {CATEGORIES.map((category, index) => (
              <Reveal
                key={category.title}
                as="li"
                from="up"
                delay={(index % 3) * 0.07}
                className="group bg-paper p-8 transition-colors duration-300 hover:bg-paper-sunk lg:p-10"
              >
                <span
                  aria-hidden
                  className="block h-1 w-10 transition-all duration-300 group-hover:w-16"
                  style={{
                    backgroundColor:
                      index % 2 === 0
                        ? 'var(--color-support)'
                        : 'var(--color-accent)',
                  }}
                />
                <h2 className="mt-6 text-h4 font-bold">{category.title}</h2>
                <p className="mt-3 text-ink-soft">{category.body}</p>
              </Reveal>
            ))}
          </ul>

          {/* An honest note. There is no live catalogue on this site yet — the
              ordering platform is a separate system — so the page does not
              pretend to be a shop front with a basket. */}
          <p className="mt-14 max-w-measure text-ink-faint">
            Prices move week to week, so they are not listed here. Message us
            for what you need and we will quote the current price.
          </p>
        </div>
      </section>

      <section className="bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <h2 className="max-w-[18ch] text-h1">Who shops with us</h2>

          <ul className="mt-16 grid grid-cols-1 gap-10 md:grid-cols-2">
            {SEGMENTS.map((segment, index) => (
              <Reveal
                key={segment.title}
                as="li"
                from="up"
                delay={(index % 2) * 0.07}
                className="border-t border-ink pt-6"
              >
                <h3 className="text-h4 font-bold">{segment.title}</h3>
                <p className="mt-3 max-w-measure text-ink-soft">
                  {segment.body}
                </p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
