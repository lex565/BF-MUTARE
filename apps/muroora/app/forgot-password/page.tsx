import type { Metadata } from 'next'

import { ForgotPasswordForm } from '@/app/forgot-password/ForgotPasswordForm'

export const metadata: Metadata = {
  title: 'Forgotten password',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />
}
