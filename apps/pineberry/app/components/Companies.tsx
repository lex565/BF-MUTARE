import { BRANDS, Eyebrow, Reveal, type Brand } from '@pineberry/ui'

/**
 * The companies register.
 *
 * Three operating businesses is too few for a card grid — three equal tiles
 * read as a placeholder waiting for a fourth. The elegant holding-company
 * sites (LVMH's maisons, Remgro's portfolio) give each business a full band
 * of the page instead, so the list reads as a considered set rather than a
 * directory. That is what this does: one company per band, alternating the
 * accent rule, generous vertical space, no boxes.
 */
function CompanyBand({ brand, index }: { brand: Brand; index: number }) {
  const Wrapper = brand.href ? 'a' : 'div'

  return (
    <Reveal as="li" from="up" delay={index * 0.06} className="border-b border-rule">
      <Wrapper
        {...(brand.href
          ? { href: brand.href, target: '_blank', rel: 'noopener noreferrer' }
          : {})}
        className={`group block py-14 lg:py-20 ${brand.href ? 'cursor-pointer' : ''}`}
      >
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-12">
          <div className="lg:col-span-1">
            <span className="font-mono text-micro tracking-label text-ink-faint">
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>

          <div className="lg:col-span-5">
            <div className="flex items-center gap-4">
              {/* The company's own accent, pulled from the shared brand record
                  so this swatch and that company's site can never drift. */}
              <span
                aria-hidden
                className="h-8 w-1 shrink-0"
                style={{ backgroundColor: brand.palette.accent }}
              />
              <h3 className="text-h2 transition-colors duration-300 group-hover:text-accent">
                {brand.name}
              </h3>
            </div>
            <p className="mt-5 max-w-measure text-lead text-ink-soft">
              {brand.line}
            </p>
          </div>

          <div className="lg:col-span-4">
            <p className="max-w-measure text-ink-soft">{brand.detail}</p>
            <ul className="mt-6 flex flex-wrap gap-x-2 gap-y-2">
              {brand.activities.map((activity) => (
                <li
                  key={activity}
                  className="border border-rule px-3 py-1 font-mono text-micro uppercase tracking-label text-ink-faint"
                >
                  {activity}
                </li>
              ))}
            </ul>
          </div>

          <dl className="lg:col-span-2 lg:text-right">
            <div>
              <dt className="sr-only">Sector</dt>
              <dd className="font-mono text-micro uppercase tracking-label text-ink-faint">
                {brand.sector}
              </dd>
            </div>
            <div className="mt-2">
              <dt className="sr-only">Base</dt>
              <dd className="font-mono text-micro uppercase tracking-label text-ink-faint">
                {brand.base}
              </dd>
            </div>
            <div className="mt-6">
              <dt className="sr-only">Website</dt>
              <dd className="font-mono text-micro uppercase tracking-label">
                {brand.href ? (
                  <span className="text-accent">Visit site ↗</span>
                ) : (
                  // Trading without a website is a fact, not a shortcoming —
                  // said plainly rather than dressed up as "coming soon".
                  <span className="text-support">Trading</span>
                )}
              </dd>
            </div>
          </dl>
        </div>
      </Wrapper>
    </Reveal>
  )
}

export function Companies() {
  return (
    <section id="companies" className="border-b border-rule">
      <div className="mx-auto max-w-[80rem] px-gutter py-section">
        <Eyebrow index={1}>The companies</Eyebrow>
        <h2 className="mt-6 max-w-[18ch] text-h1">What we own and run</h2>
        <p className="mt-8 max-w-measure text-lead text-ink-soft">
          Three businesses, all trading. One has a website so far; the other
          two are being built.
        </p>

        <ul className="mt-16 border-t border-ink">
          {BRANDS.map((brand, index) => (
            <CompanyBand key={brand.slug} brand={brand} index={index} />
          ))}
        </ul>
      </div>
    </section>
  )
}
