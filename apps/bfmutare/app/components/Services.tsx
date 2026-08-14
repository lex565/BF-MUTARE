import { Reveal } from '@pineberry/ui'
import { SERVICES } from '@/app/data/services'

/**
 * The nine services, recovered from the 2.0 build.
 *
 * 2.0 rendered these as nine FontAwesome icons in 3D-tilting cards. The icons
 * are dropped here on purpose: at nine items a wall of generic glyphs (a car, a
 * truck, a percent sign) adds no information and takes an icon font off a CDN
 * to say what the heading already says. The numbered rules used elsewhere on
 * this site carry the same list with less noise and no extra request.
 */
export function Services() {
  return (
    <section id="services" className="border-y border-rule bg-paper-sunk">
      <div className="mx-auto max-w-[86rem] px-gutter py-section">
        <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
          <span
            aria-hidden
            className="mr-3 inline-block h-px w-8 bg-accent align-middle"
          />
          What we do
        </p>
        <h2 className="mt-5 max-w-[18ch] text-h1">
          Everything between the auction and your driveway
        </h2>
        <p className="mt-6 max-w-measure text-lead text-ink-soft">
          Importing a vehicle privately means dealing with a shipping agent, a
          clearing agent and ZIMRA yourself. This is the list of what we take
          off you.
        </p>

        <ol className="mt-16 grid grid-cols-1 gap-px bg-rule md:grid-cols-2 xl:grid-cols-3">
          {SERVICES.map((service, index) => (
            <Reveal
              key={service.title}
              as="li"
              from="up"
              /* Delay resets every row so the stagger reads left-to-right per
                 row rather than accumulating to a two-second wait by item
                 nine. */
              delay={(index % 3) * 0.07}
              /* Nine items divide evenly into three columns but leave a hole
                 in two, so the last one spans the row at the two-column
                 breakpoint. Without this there is a visible empty panel. */
              className="group bg-paper-sunk p-8 transition-colors duration-300 hover:bg-paper md:last:col-span-2 xl:last:col-span-1"
            >
              {/* The numeral and a rule that runs out to the edge of the cell.
                  The rule is what turns nine separate numbers into a sequence
                  you read across, and it grows on hover so the whole cell
                  responds to the pointer as one object. */}
              <div className="flex items-center gap-4">
                <span aria-hidden className="numeral text-h2">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span
                  aria-hidden
                  className="h-px flex-1 origin-left bg-rule transition-colors duration-300 group-hover:bg-accent"
                />
              </div>

              <h3 className="mt-7 text-h4 font-semibold">{service.title}</h3>
              <p className="mt-3 leading-relaxed text-ink-soft">
                {service.body}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
