import type { Metadata } from 'next'
import { Reveal } from '@pineberry/ui'
import { PageHeader } from '@/app/components/PageHeader'
import { STORY, VISION, MISSION, VALUES, LEGAL, SITE } from '@/app/data/site'

export const metadata: Metadata = {
  title: 'The story',
  description:
    'How 420 Liquor Store got its name: a daily 4:20 ritual between two friends in Mutare. And why, here, 420 is a time of day.',
}

export default function StoryPage() {
  return (
    <main>
      <PageHeader
        eyebrow="The story"
        title="Haaa, it’s 4:20"
        intro={STORY.lead}
      />

      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div className="max-w-measure space-y-6 text-lead text-ink-soft">
            {STORY.paragraphs.map((paragraph) => (
              <p key={paragraph.slice(0, 40)}>{paragraph}</p>
            ))}
          </div>

          {/* The founders' note, set as the pull quote it is. */}
          <Reveal
            from="up"
            className="mt-16 max-w-3xl border-l-4 border-accent bg-paper-sunk p-8 lg:p-10"
          >
            <blockquote>
              <p className="font-display text-h2 leading-tight text-ink">
                &ldquo;{STORY.founderQuote}&rdquo;
              </p>
              <footer className="mt-6 font-mono text-micro uppercase tracking-label text-ink-faint">
                — {STORY.founderAttribution}
              </footer>
            </blockquote>
          </Reveal>
        </div>
      </section>

      {/* The legal position gets a section of its own here rather than a
          footnote. On a brand called 420 it is the second question anyone
          asks, so it is answered plainly and in full. */}
      <section className="border-b border-rule bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div aria-hidden className="gold-rule h-px w-full" />
          <h2 className="mt-8 max-w-[18ch] text-h1">Where we stand</h2>
          <div className="mt-8 max-w-measure space-y-5 text-lead text-ink-soft">
            <p>{LEGAL.notCannabis}</p>
            <p>{LEGAL.licensed}</p>
            <p>{LEGAL.responsible}</p>
          </div>
          <p className="stamp mt-10">{SITE.minimumAge}+ only</p>
        </div>
      </section>

      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-2">
            <div>
              <p className="font-mono text-micro uppercase tracking-label text-accent">
                Vision
              </p>
              <p className="mt-6 text-lead text-ink-soft">{VISION}</p>
            </div>
            <div>
              <p className="font-mono text-micro uppercase tracking-label text-accent">
                Mission
              </p>
              <p className="mt-6 text-lead text-ink-soft">{MISSION}</p>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div aria-hidden className="gold-rule h-px w-full" />
          <h2 className="mt-8 max-w-[18ch] text-h1">What we hold to</h2>

          <ul className="mt-14 grid grid-cols-1 gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((value, index) => (
              <Reveal
                key={value.title}
                as="li"
                from="up"
                delay={(index % 3) * 0.06}
                className="bg-paper p-8"
              >
                <h3 className="text-h4 text-accent">{value.title}</h3>
                <p className="mt-3 text-ink-soft">{value.body}</p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
