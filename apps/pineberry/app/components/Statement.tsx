import { BRANDS, operatingBrands } from '@pineberry/ui'
import { SITE } from '@/app/data/site'

const operating = operatingBrands().length
const sectors = new Set(BRANDS.map((brand) => brand.sector)).size

/**
 * The opening statement. No hero image, on purpose.
 *
 * A holding company has no product to photograph — the honest picture of
 * Pineberry is its list of companies, and that is the next section. Putting a
 * stock boardroom or a skyline here would be the exact tell we are avoiding.
 * So the first screen is type, set large, on paper.
 */
export function Statement() {
  return (
    <section id="top" className="border-b border-rule">
      <div className="mx-auto max-w-[80rem] px-gutter py-section">
        <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
          {SITE.address.city}, {SITE.address.country}
          {SITE.founded ? ` — since ${SITE.founded}` : ''}
        </p>

        <h1 className="mt-10 max-w-[16ch] text-mega leading-[0.94]">
          A small group of
          <span className="text-accent">&nbsp;real&nbsp;</span>
          businesses
        </h1>

        <div className="mt-14 grid grid-cols-1 gap-12 border-t border-rule pt-10 md:grid-cols-12">
          <p className="max-w-measure text-lead text-ink-soft md:col-span-7">
            {SITE.summary} We are not an investment fund and we do not run a
            portfolio at arm&rsquo;s length. Each company here has staff,
            premises and customers, and someone whose name is on it.
          </p>

          <dl className="grid grid-cols-2 gap-8 md:col-span-5 md:grid-cols-1 md:gap-6">
            <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
              <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                Companies
              </dt>
              <dd className="font-display text-h3">{BRANDS.length}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
              <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                Trading now
              </dt>
              <dd className="font-display text-h3">{operating}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
              <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                Sectors
              </dt>
              <dd className="font-display text-h3">{sectors}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-4 border-b border-rule pb-3">
              <dt className="font-mono text-micro uppercase tracking-label text-ink-faint">
                Based
              </dt>
              <dd className="font-display text-h3">Zimbabwe</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  )
}
