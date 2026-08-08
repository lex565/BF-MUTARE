import { BRANDS, Eyebrow } from '@pineberry/ui'
import { SITE } from '@/app/data/site'

/** Contact plus footer, as one closing block. */
export function Colophon() {
  return (
    <footer id="contact">
      <div className="mx-auto max-w-[80rem] px-gutter py-section">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Eyebrow index={3}>Contact</Eyebrow>
            <h2 className="mt-6 max-w-[14ch] text-h1">Talk to the group</h2>
            <p className="mt-8 max-w-measure text-lead text-ink-soft">
              For anything about a specific company, go straight to that
              company — they answer faster. For anything about the group,
              partnerships or property, write to us here.
            </p>
            <a
              href={`mailto:${SITE.email}`}
              className="mt-10 inline-block border-b-2 border-accent pb-1 font-display text-h3 transition-colors duration-200 hover:text-accent"
            >
              {SITE.email}
            </a>
          </div>

          <div className="lg:col-span-5 lg:pt-16">
            <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
              Group companies
            </p>
            <ul className="mt-4 space-y-2">
              {BRANDS.map((brand) => (
                <li key={brand.slug}>
                  {brand.href ? (
                    <a
                      href={brand.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-accent"
                    >
                      {brand.name} ↗
                    </a>
                  ) : (
                    <span className="text-ink-faint">
                      {brand.name} — site in progress
                    </span>
                  )}
                </li>
              ))}
            </ul>

            <address className="mt-10 not-italic text-ink-soft">
              {SITE.address.city}
              <br />
              {SITE.address.country}
            </address>
          </div>
        </div>

        <div className="mt-20 flex flex-wrap items-center justify-between gap-4 border-t border-rule pt-8 font-mono text-micro text-ink-faint">
          <span>
            © {new Date().getFullYear()} {SITE.legalName}
          </span>
          <span className="flex items-center gap-2">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            {SITE.address.country}
          </span>
        </div>
      </div>
    </footer>
  )
}
