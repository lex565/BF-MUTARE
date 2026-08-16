import type { Metadata } from 'next'

import { requireAdminView } from '@/lib/auth'
import { format } from '@/lib/money'
import { listAllZones } from '@/lib/services/delivery'
import { AddZoneForm, ZoneToggle } from '@/app/admin/delivery/ZoneForms'

export const metadata: Metadata = {
  title: 'Delivery areas',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function AdminDeliveryPage() {
  await requireAdminView()

  const zones = await listAllZones()
  const active = zones.filter((z) => z.isActive)

  return (
    <main className="mx-auto max-w-[86rem] px-gutter py-12">
      <header className="border-b border-rule pb-8">
        <p className="font-mono text-micro uppercase tracking-label text-ink-faint">
          Admin
        </p>
        <h1 className="mt-3 text-h1">Delivery areas</h1>
        <p className="mt-4 max-w-measure text-ink-soft">
          Where you deliver, and what it costs. A customer types their suburb at
          checkout and gets the fee for whichever area it belongs to. If the
          suburb is not in any area, the order is refused rather than given a
          guessed price.
        </p>

        {active.length === 0 && (
          <div className="mt-8 max-w-measure border-l-4 border-accent bg-paper-sunk p-6">
            <p className="font-bold">
              Nothing can be ordered until you add at least one area.
            </p>
            <p className="mt-3 text-small text-ink-soft">
              Checkout needs a delivery fee, and a fee only comes from an area.
              No areas or prices have been invented for you — these are your
              roads and your costs. Add the ones you actually cover below.
            </p>
          </div>
        )}
      </header>

      <section className="border-b border-rule py-10">
        <h2 className="text-h3 font-bold">Add an area</h2>
        <AddZoneForm />
      </section>

      <section className="py-10">
        <h2 className="text-h3 font-bold">
          {zones.length === 0 ? 'No areas yet' : 'Where you deliver'}
        </h2>

        {zones.length > 0 && (
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse">
              <thead>
                <tr className="border-b border-ink text-left">
                  {[
                    'Area',
                    'Suburbs',
                    'Fee',
                    'Smallest order',
                    'Usually takes',
                    '',
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="py-3 pr-6 font-mono text-micro uppercase tracking-label text-ink-faint"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zones.map((zone) => (
                  <tr key={zone.id} className="border-b border-rule align-top">
                    <td className="py-4 pr-6">
                      <span className="font-bold">{zone.name}</span>
                      {!zone.isActive && (
                        <span className="mt-1 block font-mono text-micro uppercase tracking-label text-accent">
                          not delivering
                        </span>
                      )}
                    </td>
                    <td className="py-4 pr-6 text-small text-ink-soft">
                      {zone.suburbs.join(', ')}
                    </td>
                    <td className="py-4 pr-6 font-mono text-small tabular-nums">
                      {format(zone.fee)}
                    </td>
                    <td className="py-4 pr-6 font-mono text-small tabular-nums text-ink-faint">
                      {zone.minimumOrder.amount > 0n
                        ? format(zone.minimumOrder)
                        : 'no minimum'}
                    </td>
                    <td className="py-4 pr-6 text-small text-ink-soft">
                      {zone.estimatedMinutesMin && zone.estimatedMinutesMax
                        ? `${zone.estimatedMinutesMin}–${zone.estimatedMinutesMax} min`
                        : '—'}
                    </td>
                    <td className="py-4">
                      <ZoneToggle
                        id={zone.id}
                        name={zone.name}
                        isActive={zone.isActive}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-6 max-w-measure text-small text-ink-faint">
              An area is never deleted, only switched off — orders already
              placed point at it, and deleting one would leave last month&rsquo;s
              deliveries unable to say what they were priced for. Switching an
              area off hides it from checkout straight away; orders already
              placed for it still need delivering, and you will be told how many.
            </p>
          </div>
        )}
      </section>
    </main>
  )
}
