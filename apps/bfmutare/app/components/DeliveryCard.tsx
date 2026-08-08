import Image from 'next/image'
import type { Delivery } from '@/app/data/deliveries'

/**
 * A delivered vehicle. No price, no status, no date — this car is with its
 * owner. The card exists to prove the work happened, not to sell the vehicle.
 */
export function DeliveryCard({ vehicle }: { vehicle: Delivery }) {
  const title = [vehicle.make, vehicle.model, vehicle.variant]
    .filter(Boolean)
    .join(' ')

  const specs: Array<[string, string]> = [
    ['Body', vehicle.bodyType],
    ['Colour', vehicle.colour],
    ['Drive', vehicle.drive],
  ]

  return (
    <article className="group flex h-full flex-col border border-rule bg-paper-sunk transition-colors duration-300 hover:border-ink-faint">
      <div className="relative aspect-4/3 overflow-hidden bg-paper">
        <Image
          src={vehicle.images[0]}
          alt={`${title}, ${vehicle.colour.toLowerCase()}`}
          fill
          sizes="(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 33vw"
          className="object-cover transition-transform duration-[900ms] ease-[var(--ease-out-quint)] group-hover:scale-[1.04]"
        />

        {/* Plate code sits bottom-left, exactly where it sits on the car. */}
        <span className="plate absolute bottom-3 left-3 text-small">
          {vehicle.plate}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-h4 font-semibold">{title}</h3>
        <p className="mt-2 text-small text-ink-soft">{vehicle.note}</p>

        <dl className="mt-auto grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-rule pt-4 font-mono text-micro">
          {specs.map(([label, value]) => (
            <div key={label} className="flex justify-between gap-2">
              <dt className="uppercase tracking-label text-ink-faint">{label}</dt>
              <dd className="text-ink-soft">{value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  )
}
