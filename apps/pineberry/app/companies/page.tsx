import type { Metadata } from 'next'
import { BRANDS } from '@pineberry/ui'
import { SiteNav } from '@/app/components/SiteNav'
import { PageHeader } from '@/app/components/PageHeader'
import { Companies } from '@/app/components/Companies'
import { Colophon } from '@/app/components/Colophon'

export const metadata: Metadata = {
  title: 'Companies',
  description:
    'The four businesses Pineberry Holdings owns and runs: BF Mutare, Muroora Mart, Speed Motor Engineering and 420 Liquor Store.',
}

export default function CompaniesPage() {
  const sectors = [...new Set(BRANDS.map((brand) => brand.sector))]

  return (
    <>
      <SiteNav />
      <main>
        <PageHeader
          eyebrow="The companies"
          title="Four businesses, all trading"
          intro={`Two in automotive, two in retail. All four are in ${BRANDS[0].base} or run out of it, and each one now has a site of its own.`}
        />

        <section className="border-b border-rule bg-paper-sunk">
          <div className="mx-auto max-w-[80rem] px-gutter py-14">
            <dl className="grid grid-cols-2 gap-8 md:grid-cols-4">
              <div>
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Companies
                </dt>
                <dd className="mt-2 font-display text-h2">{BRANDS.length}</dd>
              </div>
              <div>
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Sectors
                </dt>
                <dd className="mt-2 font-display text-h2">{sectors.length}</dd>
              </div>
              <div>
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Oldest
                </dt>
                <dd className="mt-2 font-display text-h2">1996</dd>
              </div>
              <div>
                <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Based
                </dt>
                <dd className="mt-2 font-display text-h2">Zimbabwe</dd>
              </div>
            </dl>
          </div>
        </section>

        {/* The register itself, without repeating a heading the page already
            has. */}
        <Companies heading={false} />
      </main>
      <Colophon />
    </>
  )
}
