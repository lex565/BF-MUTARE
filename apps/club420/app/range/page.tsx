import type { Metadata } from 'next'
import Image from 'next/image'
import { Reveal } from '@pineberry/ui'
import { PageHeader } from '@/app/components/PageHeader'
import { RANGE, SITE } from '@/app/data/site'

export const metadata: Metadata = {
  title: 'The range',
  description:
    'Whiskey, gin, vodka, rum, cognac, wine and Zimbabwean craft spirits, plus barware and branded pieces. Over 18s only.',
}

/** The client's own shelf photographs. */
const SHELF = [
  'shelf-01.jpg',
  'shelf-02.jpg',
  'shelf-03.jpg',
  'shelf-04.jpg',
  'shelf-05.jpg',
  'shelf-06.jpg',
]

export default function RangePage() {
  return (
    <main>
      <PageHeader
        eyebrow="The range"
        title="What we pour"
        intro="Curated rather than comprehensive. The shelf we are proudest of is the Zimbabwean craft one."
      />

      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <ul className="grid grid-cols-1 gap-px bg-rule sm:grid-cols-2 xl:grid-cols-4">
            {RANGE.map((item, index) => (
              <Reveal
                key={item.title}
                as="li"
                from="up"
                delay={(index % 4) * 0.06}
                className="group bg-paper p-8 transition-colors duration-300 hover:bg-paper-sunk"
              >
                <span
                  aria-hidden
                  className="font-mono text-micro tracking-label text-accent"
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h2 className="mt-5 text-h4">{item.title}</h2>
                <p className="mt-2 text-small text-ink-soft">{item.body}</p>
              </Reveal>
            ))}
          </ul>

          {/* No prices, and the reason is stated rather than left as a gap.
              The earlier draft of this site carried six invented USD figures. */}
          <p className="mt-14 max-w-measure text-ink-faint">
            Prices are not listed here. Stock and landed cost move too often for
            a web page to stay honest about them, and a price that is wrong at
            the till is worse than no price at all. Ask us and you get today’s.
          </p>
        </div>
      </section>

      <section className="bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div aria-hidden className="gold-rule h-px w-full" />
          <h2 className="mt-8 max-w-[16ch] text-h1">On the shelf</h2>
          <p className="mt-7 max-w-measure text-lead text-ink-soft">
            Photographs from the store, not a catalogue. What is in them on any
            given day is what was in them that day.
          </p>

          <ul className="mt-14 grid grid-cols-2 gap-3 md:grid-cols-3">
            {SHELF.map((file, index) => (
              <Reveal
                key={file}
                as="li"
                from="up"
                delay={(index % 3) * 0.06}
                className="relative aspect-square overflow-hidden"
              >
                <Image
                  src={`/photos/${file}`}
                  alt=""
                  fill
                  sizes="(max-width: 768px) 50vw, 30vw"
                  className="object-cover transition-transform duration-700 ease-[var(--ease-out-quint)] hover:scale-[1.04]"
                />
              </Reveal>
            ))}
          </ul>

          <p className="stamp mt-14">{SITE.minimumAge}+ only</p>
        </div>
      </section>
    </main>
  )
}
