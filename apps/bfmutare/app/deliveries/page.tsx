import type { Metadata } from 'next'
import { PageHeader } from '@/app/components/PageHeader'
import { Deliveries } from '@/app/components/Deliveries'

export const metadata: Metadata = {
  title: 'Deliveries',
  description:
    'Vehicles BF Mutare has imported from Japan and delivered to owners across Zimbabwe.',
}

export default function DeliveriesPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Deliveries"
        title="Cars we brought in"
        intro="Every vehicle here is already with its owner. This is a selection of what has come through — not the full record."
      />
      <Deliveries />
    </main>
  )
}
