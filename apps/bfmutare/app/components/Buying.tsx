import { Reveal } from '@pineberry/ui'

/**
 * The naaz.org.zw "highlights" block, repurposed. On a dealer site the useful
 * version of that pattern is not three feature boasts — it is telling someone
 * what actually happens between wanting a car and driving one, because that is
 * the thing buyers are nervous about.
 */
const STEPS = [
  {
    title: 'Come and see it',
    body: 'Everything on this page is in Mutare and can be looked at, sat in and driven. No deposit to view.',
  },
  {
    title: 'We check the paperwork together',
    body: 'Registration, duty status and the import file, in front of you, before any money moves.',
  },
  {
    title: 'Or we import to order',
    body: 'Not on the lot? Tell us the model, the budget and the timeline, and we source it from Japan.',
  },
  {
    title: 'Drive it away',
    body: 'Payment, transfer of ownership and plates sorted. You leave with the car and the file.',
  },
]

export function Buying() {
  return (
    <section id="buying" className="border-y border-rule bg-paper-sunk">
      <div className="mx-auto max-w-[86rem] px-gutter py-section">
        <p className="font-mono text-micro uppercase tracking-label text-ink-faint"><span aria-hidden className="mr-3 inline-block h-px w-8 align-middle bg-accent" />How buying works</p>
        <h2 className="mt-5 max-w-[16ch] text-h1">
          Four steps, no surprises
        </h2>

        {/* Numbered rules rather than cards. A dealer explaining a process
            should look like a document, not a pricing table. */}
        <ol className="mt-16 grid grid-cols-1 gap-px bg-rule md:grid-cols-2 xl:grid-cols-4">
          {STEPS.map((step, index) => (
            <Reveal
              key={step.title}
              as="li"
              from="up"
              delay={index * 0.07}
              className="bg-paper-sunk p-8"
            >
              <span className="font-mono text-micro uppercase tracking-label text-accent">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-6 text-h4 font-semibold">{step.title}</h3>
              <p className="mt-3 text-small leading-relaxed text-ink-soft">
                {step.body}
              </p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  )
}
