import type { Metadata } from 'next'
import { PageHeader } from '@/app/components/PageHeader'
import { Team } from '@/app/components/Team'

export const metadata: Metadata = {
  title: 'Team',
  description:
    'The people behind BF Mutare — sales, marketing, logistics, information systems, accounts and transport.',
}

export default function TeamPage() {
  return (
    <main>
      <PageHeader
        eyebrow="The team"
        title="Who runs what"
        intro="Six people, six departments. Pick a name to see what they are responsible for."
      />
      <Team />
    </main>
  )
}
