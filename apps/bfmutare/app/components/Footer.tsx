import { SITE } from '@/app/data/site'

export function Footer() {
  return (
    <footer className="border-t border-rule">
      <div className="mx-auto flex max-w-[86rem] flex-col gap-8 px-gutter py-12 md:flex-row md:items-end md:justify-between">
        <div>
          <a href="#top" className="flex items-baseline gap-2">
            <span className="plate text-small leading-none">BF</span>
            <span className="font-display text-lead font-bold uppercase tracking-tight">
              Mutare
            </span>
          </a>
          <p className="mt-4 max-w-[34ch] text-small text-ink-faint">
            {SITE.tagline}
          </p>
        </div>

        <div className="flex flex-col gap-3 md:items-end">
          <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
            A {SITE.parent} company
          </p>
          <a
            href="https://pineberryholdings.com"
            className="font-mono text-micro uppercase tracking-label text-ink-soft transition-colors hover:text-accent"
          >
            pineberryholdings.com ↗
          </a>
          <p className="mt-2 font-mono text-micro text-ink-faint">
            © {new Date().getFullYear()} {SITE.legalName}
          </p>
        </div>
      </div>
    </footer>
  )
}
