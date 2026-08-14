import type { Metadata } from 'next'
import { DeliveryHero } from '@/app/components/DeliveryHero'
import { Deliveries } from '@/app/components/Deliveries'

export const metadata: Metadata = {
  title: 'Deliveries',
  description:
    'Vehicles BF Mutare has imported and delivered to owners across Zimbabwe.',
}

export default function DeliveriesPage() {
  return (
    <main>
      <DeliveryHero />
      <Deliveries />
    </main>
  )
}
