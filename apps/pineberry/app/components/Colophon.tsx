import { BRANDS, Eyebrow, brandHref } from '@pineberry/ui'
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

            {/* Only rendered when there is a real address. This used to print
                hello@pineberryholdings.com as a large mailto link on every
                page; that domain does not resolve, so anyone who wrote to it
                got silence and reasonably concluded they had been ignored. */}
            {SITE.email ? (
              <a
                href={`mailto:${SITE.email}`}
                className="mt-10 inline-block border-b-2 border-accent pb-1 font-display text-h3 transition-colors duration-200 hover:text-accent"
              >
                {SITE.email}
              </a>
            ) : (
              <p className="mt-10 max-w-measure border-l-4 border-support pl-5 text-ink-soft">
                A group address is not published yet. Until it is, the fastest
                route to anyone here is through whichever company you need —
                they are all listed to the right.
              </p>
            )}
          </div>

          <div className="lg:col-span-5 lg:pt-16">
            <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
              Group companies
            </p>
            {/* Every company has a site now, so this links them all rather
                than reporting three of four as "in progress". brandHref falls
                back to the local dev port until real domains are set on the
                brand records, so these are clickable throughout the build. */}
            <ul className="mt-4 space-y-2">
              {BRANDS.map((brand) => (
                <li key={brand.slug}>
                  <a
                    href={brandHref(brand)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2.5 transition-colors hover:text-accent"
                  >
                    <span
                      aria-hidden
                      className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: brand.palette.accent }}
                    />
                    {brand.fullName ?? brand.name} ↗
                  </a>
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
