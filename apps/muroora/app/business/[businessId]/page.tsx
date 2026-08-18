import { redirect } from 'next/navigation'

import { BusinessWorkspace } from './BusinessWorkspace'
import { currentUser } from '@/lib/auth'
import { businessCatalogue } from '@/lib/services/business-catalogue'

export const dynamic = 'force-dynamic'

export default async function BusinessPage({ params }: { params: Promise<{ businessId: string }> }) {
  const user = await currentUser()
  if (!user) redirect('/login?next=/account')
  const { businessId } = await params
  const data = await businessCatalogue(user.id, businessId)
  return <main className="mx-auto max-w-[72rem] px-gutter py-12">
    <p className="font-mono text-micro uppercase tracking-label text-accent">Business workspace</p>
    <h1 className="mt-3 text-h1">{data.membership.name}</h1>
    <p className="mt-3 text-ink-soft">Manage this business’s public profile and Musuwo catalogue.</p>
    <BusinessWorkspace businessId={businessId} canWrite={data.membership.canWrite} profile={data.profile} categories={data.categories} products={data.products} />
  </main>
}
