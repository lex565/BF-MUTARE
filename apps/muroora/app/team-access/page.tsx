import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AccessLoginForm } from '@/app/components/auth/AccessLoginForm'
import { currentUser } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Team access',
  robots: { index: false, follow: false },
}

export default async function TeamAccessPage() {
  if (await currentUser()) redirect('/staff')

  return (
    <AccessLoginForm
      next="/staff"
      label="Team access"
      description="For authorised Muroora Mart staff. Use the account issued to you by management."
      allowCreateAccount
      managementLink
    />
  )
}
