import Image from 'next/image'
import { BRANDS, Reveal, brandHref, type Brand } from '@pineberry/ui'

/**
 * The companies register.
 *
 * One company per band rather than a card grid — four equal tiles read as a
 * directory, and the elegant holding-company sites (LVMH's maisons, Remgro's
 * portfolio) give each business a full band instead. Generous vertical space,
 * alternating accent, no boxes.
 *
 * Each band now carries the company's real logo. Where no artwork exists — 420
 * has none drawn yet — the name is set as type in the company's own accent
 * rather than showing an empty frame.
 */
function BrandLogo({ brand }: { brand: Brand }) {
  if (!brand.logo) {
    return (
      <span
        className="font-display text-h2 leading-none"
        style={{ color: brand.palette.accent }}
      >
        {brand.name}
      </span>
    )
  }

  return (
    <span
      /* The logos are drawn for their own sites' grounds: Speed Motors' is
         pure black, BF Mutare's is a light-on-dark mark. On this warm paper
         they sit in a tinted plate keyed to each company's own accent, which
         keeps every one of them legible without recolouring anyone's artwork. */
      className="flex h-24 w-full max-w-[15rem] items-center justify-center px-5"
      style={{ backgroundColor: `${brand.palette.accent}0f` }}
    >
      <Image
        src={brand.logo}
        alt={`${brand.fullName ?? brand.name} logo`}
        width={320}
        height={120}
        className="h-auto max-h-14 w-auto max-w-full object-contain"
      />
    </span>
  )
}

function CompanyBand({ brand, index }: { brand: Brand; index: number }) {
  const href = brandHref(brand)

  return (
    <Reveal
      as="li"
      from="up"
      delay={index * 0.06}
      className="border-b border-rule"
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="group block py-14 lg:py-20"
      >
        <div className="grid grid-cols-1 gap-x-10 gap-y-8 lg:grid-cols-12">
          <div className="lg:col-span-1">
            <span className="font-mono text-micro tracking-label text-ink-faint">
              {String(index + 1).padStart(2, '0')}
            </span>
          </div>

          <div className="lg:col-span-3">
            <BrandLogo brand={brand} />
          </div>

          <div className="lg:col-span-4">
            <div className="flex items-center gap-4">
              <span
                aria-hidden
                className="h-8 w-1 shrink-0"
                style={{ backgroundColor: brand.palette.accent }}
              />
              <h3 className="text-h3 transition-colors duration-300 group-hover:text-accent">
                {brand.fullName ?? brand.name}
              </h3>
            </div>
            <p className="mt-5 max-w-measure text-lead text-ink-soft">
              {brand.line}
            </p>
            <p className="mt-4 max-w-measure text-ink-soft">{brand.detail}</p>
          </div>

          <div className="lg:col-span-2">
            <ul className="flex flex-wrap gap-2">
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
            {brand.founded && (
              <div className="mt-2">
                <dt className="sr-only">Founded</dt>
                <dd className="font-mono text-micro uppercase tracking-label text-ink-faint">
                  Est. {brand.founded}
                </dd>
              </div>
            )}
            <div className="mt-6">
              <dt className="sr-only">Website</dt>
              <dd className="font-mono text-micro uppercase tracking-label text-accent">
                Visit site ↗
              </dd>
            </div>
          </dl>
        </div>
      </a>
    </Reveal>
  )
}

export function Companies({ heading = true }: { heading?: boolean }) {
  return (
    <section id="companies" className="border-b border-rule">
      <div className="mx-auto max-w-[80rem] px-gutter py-section">
        {heading && (
          <>
            <p className="flex items-center gap-3 font-mono text-micro uppercase tracking-label text-ink-faint">
              <span aria-hidden className="h-px w-8 bg-support" />
              The companies
            </p>
            <h2 className="mt-6 max-w-[18ch] text-h1">What we own and run</h2>
            <p className="mt-8 max-w-measure text-lead text-ink-soft">
              Four businesses, all trading. Every one of them now has a site of
              its own.
            </p>
          </>
        )}

        <ul className={`${heading ? 'mt-16' : ''} border-t border-ink`}>
          {BRANDS.map((brand, index) => (
            <CompanyBand key={brand.slug} brand={brand} index={index} />
          ))}
        </ul>
      </div>
    </section>
  )
}
