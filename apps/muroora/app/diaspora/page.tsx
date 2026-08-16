import type { Metadata } from 'next'
import { Reveal } from '@pineberry/ui'
import { PageHeader } from '@/app/components/PageHeader'
import { DIASPORA_STEPS, PAYMENTS } from '@/app/data/site'

export const metadata: Metadata = {
  title: 'Diaspora shopping',
  description:
    'Buy groceries for your family in Mutare from anywhere. You choose the goods, we pack and deliver them, and you both get confirmation.',
}

export default function DiasporaPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Diaspora shopping"
        title="Send the shopping, not the money"
        intro="You are in the UK, South Africa, Australia or anywhere else. You pick the goods off our catalogue, we pack them in Mutare and deliver them to the house. Nobody has to queue at an agent."
      />

      {/* The argument for the programme, stated once and plainly. This is the
          part that has to land: it is an economic point, not a convenience
          one, and the profile makes it well. */}
      <section className="border-b border-rule bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            <h2 className="text-h2 lg:col-span-5">
              Why it beats sending cash
            </h2>
            <div className="max-w-measure space-y-5 text-lead text-ink-soft lg:col-span-7">
              <p>
                Money sent home has to survive the trip. Exchange rates move,
                transfer fees take a cut, and at the other end somebody still
                has to find an agent with cash to pay out.
              </p>
              <p>
                Buying the goods directly closes that gap. The transfer stops
                being a cash transfer and becomes a commodity transfer - you
                paid for maize meal and cooking oil, and maize meal and cooking
                oil is what arrives.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Six steps, numbered. */}
      <section className="border-b border-rule">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <h2 className="max-w-[16ch] text-h1">How it works</h2>

          <ol className="mt-16 grid grid-cols-1 gap-px bg-rule md:grid-cols-2 xl:grid-cols-3">
            {DIASPORA_STEPS.map((step, index) => (
              <Reveal
                key={step.action}
                as="li"
                from="up"
                delay={(index % 3) * 0.07}
                className="group bg-paper p-8 transition-colors duration-300 hover:bg-paper-sunk"
              >
                <div className="flex items-center gap-4">
                  <span
                    aria-hidden
                    className="font-display text-h2 font-extrabold leading-none text-accent"
                  >
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span
                    aria-hidden
                    className="h-px flex-1 bg-rule transition-colors duration-300 group-hover:bg-accent"
                  />
                </div>
                <h3 className="mt-6 text-h4 font-bold">{step.action}</h3>
                <p className="mt-3 text-ink-soft">{step.detail}</p>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      {/* Payment rails, honestly labelled. */}
      <section className="bg-paper-sunk">
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <h2 className="max-w-[18ch] text-h1">How you can pay</h2>
          <p className="mt-7 max-w-measure text-lead text-ink-soft">
            Two rails are live today. Two more are being built for the diaspora
            in China, and they are marked as such rather than advertised as if
            they already worked.
          </p>

          <ul className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PAYMENTS.map((payment, index) => (
              <Reveal
                key={payment.name}
                as="li"
                from="up"
                delay={index * 0.06}
                className={`border bg-paper p-7 ${
                  payment.live ? 'border-support' : 'border-rule'
                }`}
              >
                <span
                  className={`chip ${payment.live ? 'chip-live' : 'text-ink-faint'}`}
                >
                  {payment.live ? 'Live' : 'Coming'}
                </span>
                <h3 className="mt-5 text-h4 font-bold">{payment.name}</h3>
                <p className="mt-2 text-small text-ink-soft">
                  {payment.detail}
                </p>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>
    </main>
  )
}
