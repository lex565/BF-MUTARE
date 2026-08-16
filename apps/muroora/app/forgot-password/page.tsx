import type { Metadata } from 'next'

import { ForgotPasswordForm } from '@/app/forgot-password/ForgotPasswordForm'

export const metadata: Metadata = {
  title: 'Forgotten password',
  robots: { index: false, follow: false },
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string; bad?: string }>
}) {
  const { expired, bad } = await searchParams
  return <ForgotPasswordForm expired={Boolean(expired || bad)} />
}
