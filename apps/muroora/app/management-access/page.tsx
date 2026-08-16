import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { AccessLoginForm } from '@/app/components/auth/AccessLoginForm'
import { currentUser } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Management access',
  robots: { index: false, follow: false },
}

export default async function ManagementAccessPage() {
  if (await currentUser()) redirect('/admin/products')

  return (
    <AccessLoginForm
      next="/admin/products"
      label="Management"
      description="Restricted Muroora Mart management entrance."
    />
  )
}
