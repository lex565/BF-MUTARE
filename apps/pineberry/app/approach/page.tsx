import type { Metadata } from 'next'
import { SiteNav } from '@/app/components/SiteNav'
import { PageHeader } from '@/app/components/PageHeader'
import { Approach } from '@/app/components/Approach'
import { Colophon } from '@/app/components/Colophon'

export const metadata: Metadata = {
  title: 'Approach',
  description:
    'How Pineberry Holdings works: we operate the businesses rather than hold them, in one market, and we add slowly.',
}

export default function ApproachPage() {
  return (
    <>
      <SiteNav />
      <main>
        <PageHeader
          eyebrow="Approach"
          title="How we work"
          intro="Four positions, and they are the reason the group looks the way it does rather than the way a portfolio usually looks."
        />
        <Approach heading={false} />

        <section className="border-b border-rule">
          <div className="mx-auto max-w-[80rem] px-gutter py-section">
            <div className="grid grid-cols-1 gap-14 lg:grid-cols-12">
              <h2 className="text-h2 lg:col-span-4">What we are not</h2>
              <div className="max-w-measure space-y-5 text-lead text-ink-soft lg:col-span-8">
                <p>
                  Not an investment fund. Nobody here is buying a stake and
                  waiting for an exit — the companies in this group are meant to
                  outlast whoever is currently running them.
                </p>
                <p>
                  Not a franchise operation. Each business has its own name, its
                  own customers and its own way of doing things, and the group
                  is a shared spine rather than a template stamped four times.
                </p>
                <p>
                  Not, so far, in a hurry. Two of the four have been trading for
                  years without a website at all. The websites came because the
                  businesses were ready for them, not the other way round.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Colophon />
    </>
  )
}
