import { BRANDS, PARENT, brandHref, parentHref } from './brands'

/**
 * The group bar.
 *
 * A thin strip above the nav on every operating company's site: the parent on
 * the left, the sister companies on the right. It is what makes four separate
 * sites read as one group rather than as four unrelated tabs, and it is
 * generated from the shared BRANDS record so adding a fifth company puts it on
 * every site at once.
 *
 * Each company keeps its own colours below this bar. The bar itself is set in
 * the host site's own tokens rather than in a fixed palette, so it belongs to
 * the page it sits on instead of looking like a pasted-in widget.
 *
 * `current` is the slug of the site rendering it — that company is shown but
 * not linked, because a link to the page you are already on is noise.
 */
export function GroupBar({ current }: { current: string }) {
  const siblings = BRANDS.filter((brand) => brand.slug !== current)

  return (
    <div className="border-b border-rule bg-paper-sunk">
      <div className="mx-auto flex max-w-[86rem] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-gutter py-2">
        <a
          href={parentHref()}
          className="group flex items-center gap-2 font-mono text-micro uppercase tracking-label text-ink-faint transition-colors hover:text-accent"
        >
          <span
            aria-hidden
            className="inline-block h-1.5 w-1.5 rounded-full bg-accent"
          />
          A {PARENT.name} company
          <span
            aria-hidden
            className="transition-transform duration-300 group-hover:translate-x-0.5"
          >
            ↗
          </span>
        </a>

        <nav
          aria-label="Other companies in the group"
          className="flex flex-wrap items-center gap-x-5 gap-y-1"
        >
          {siblings.map((brand) => (
            <a
              key={brand.slug}
              href={brandHref(brand)}
              className="group flex items-center gap-1.5 font-mono text-micro uppercase tracking-label text-ink-faint transition-colors hover:text-ink"
            >
              {/* Each sister carries its own accent as a dot, so the bar
                  doubles as a legend for the group's colour system. */}
              <span
                aria-hidden
                className="inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: brand.palette.accent }}
              />
              {brand.name}
            </a>
          ))}
        </nav>
      </div>
    </div>
  )
}
