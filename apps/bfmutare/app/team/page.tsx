import type { Metadata } from 'next'
import { PageHeader } from '@/app/components/PageHeader'
import { Team } from '@/app/components/Team'

export const metadata: Metadata = {
  title: 'Team',
  description:
    'The departments behind BF Mutare — sales, marketing, logistics, IT and drivers.',
}

export default function TeamPage() {
  return (
    <main>
      <PageHeader
        eyebrow="The team"
        title="Who runs what"
        intro="Five departments. Pick one to see who heads it and what they are responsible for."
      />
      <Team />
    </main>
  )
}
