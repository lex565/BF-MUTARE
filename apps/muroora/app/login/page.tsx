import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { PageHeader } from '@/app/components/PageHeader'
import { LoginForm } from '@/app/login/LoginForm'
import { currentUser } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Muroora Mart to track orders and save recipients.',
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const { next } = await searchParams
  const user = await currentUser()

  if (user) redirect(next ?? '/account')

  return (
    <main>
      <PageHeader
        eyebrow="Account"
        title="Sign in"
        intro="You do not need an account to shop. Sign in to see past orders, save the people you send to, and check out faster next time."
      />

      <section>
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          <LoginForm next={next} />
        </div>
      </section>
    </main>
  )
}
