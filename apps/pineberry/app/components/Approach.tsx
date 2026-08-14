import { Eyebrow, Reveal } from '@pineberry/ui'

/**
 * The naaz.org.zw "Why engage with us" block, rewritten to be worth reading.
 * Four short positions, numbered, set as a list rather than four icon tiles —
 * an icon above every heading is the fastest way to make a page look bought.
 */
const POSITIONS = [
  {
    title: 'We operate, we do not just hold',
    body: 'Every company here is run day to day by people inside the group. We are on the premises, not on a quarterly call.',
  },
  {
    title: 'One market, understood properly',
    body: 'Everything we own trades in Zimbabwe. We would rather know one market well than have a presence in five.',
  },
  {
    title: 'Businesses that sell real things',
    body: 'Vehicles, goods, services. Trade with a margin you can explain to a customer without a diagram.',
  },
  {
    title: 'Slow on purpose',
    body: 'The oldest company here has been trading since 1996; the youngest opened last year. We add a business when it is ready, not when the page looks empty.',
  },
]

export function Approach({ heading = true }: { heading?: boolean }) {
  return (
    <section id="approach" className="border-b border-rule bg-paper-sunk">
      <div className="mx-auto max-w-[80rem] px-gutter py-section">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12">
          <div className="lg:col-span-4">
            {heading && (
              <>
                <Eyebrow index={2}>Approach</Eyebrow>
                <h2 className="mt-6 text-h1">How we work</h2>
              </>
            )}
          </div>

          <ol className="lg:col-span-8">
            {POSITIONS.map((position, index) => (
              <Reveal
                key={position.title}
                as="li"
                from="up"
                delay={index * 0.07}
                className="grid grid-cols-[3rem_1fr] gap-x-4 border-b border-rule py-8 first:border-t"
              >
                <span className="pt-1.5 font-mono text-micro uppercase tracking-label text-accent">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div>
                  <h3 className="text-h4 font-medium">{position.title}</h3>
                  <p className="mt-2 max-w-measure text-ink-soft">
                    {position.body}
                  </p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}
