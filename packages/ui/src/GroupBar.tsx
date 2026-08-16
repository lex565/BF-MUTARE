import { PARENT, parentHref } from './brands'

/**
 * The group bar.
 *
 * A thin strip above the nav on every operating company's site, carrying one
 * link: back to the parent.
 *
 * WHY IT DOES NOT LIST THE SISTER COMPANIES
 * It used to. That was wrong. A customer on the liquor store's site has no
 * reason to be offered a car importer and a garage in the header - the
 * companies share an owner, not an audience, and cross-selling between them
 * makes each site feel like a directory page rather than that business's own
 * shopfront. It also put a permanent row of four names on every screen of
 * every site, which is a lot of furniture for something nobody clicked.
 *
 * So the relationship is one-directional by design:
 *   - every company site → Pineberry (this bar, and the footer)
 *   - Pineberry → every company (its register, contact page and colophon)
 *
 * Anyone who wants the full group is one click away, on the page whose actual
 * job is to list them.
 */
export function GroupBar() {
  return (
    <div className="border-b border-rule bg-paper-sunk">
      <div className="mx-auto flex max-w-[86rem] items-center justify-between gap-6 px-gutter py-2">
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
      </div>
    </div>
  )
}
