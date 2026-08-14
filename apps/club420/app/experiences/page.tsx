import type { Metadata } from 'next'
import { Reveal } from '@pineberry/ui'
import { PageHeader } from '@/app/components/PageHeader'
import { EXPERIENCES, SITE } from '@/app/data/site'

export const metadata: Metadata = {
  title: 'Experiences',
  description:
    'The daily 4:20 happy hour, tasting nights, cultural evenings and the loyalty club at 420 Liquor Store, Mutare.',
}

export default function ExperiencesPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Experiences"
        title="More than a bottle store"
        intro="The shop is the reason to come in. These are the reasons to stay."
      />

      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <ol className="border-t border-ink-faint">
            {EXPERIENCES.map((item, index) => (
              <Reveal
                key={item.title}
                as="li"
                from="up"
                delay={index * 0.06}
                className="group border-b border-rule"
              >
                <div className="grid grid-cols-1 gap-x-8 gap-y-4 py-10 transition-colors duration-300 group-hover:bg-paper-sunk lg:grid-cols-12">
                  <p className="font-mono text-micro uppercase tracking-label text-accent lg:col-span-3">
                    {item.time}
                  </p>
                  <h2 className="text-h2 lg:col-span-4">{item.title}</h2>
                  <p className="max-w-measure text-lead text-ink-soft lg:col-span-5">
                    {item.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div aria-hidden className="gold-rule h-px w-full" />
          <h2 className="mt-8 max-w-[20ch] text-h1">The one rule</h2>
          <p className="mt-8 max-w-measure text-lead text-ink-soft">
            Every one of these runs on the understanding that people are here to
            enjoy themselves and get home safely. We will not serve anyone under{' '}
            {SITE.minimumAge}, we will stop serving anyone who has had enough,
            and nobody here will think less of you for it.
          </p>
          <p className="stamp mt-10">{SITE.minimumAge}+ only</p>
        </div>
      </section>
    </main>
  )
}
