import type { Metadata } from 'next'
import { PageHeader } from '@/app/components/PageHeader'
import { Journal } from '@/app/components/Journal'

export const metadata: Metadata = {
  title: 'Journal',
  description:
    'Import duty, shipping times, auction grades, and what is worth bringing in this month.',
}

export default function JournalPage() {
  return (
    <main>
      <PageHeader
        eyebrow="Journal"
        title="Notes from the yard"
        intro="Import duty changes, what is worth shipping this month, and the occasional word about a car we were sorry to hand over."
      />
      <Journal />
    </main>
  )
}
