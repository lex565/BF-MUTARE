import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { PageHeader } from '@/app/components/PageHeader'
import { brand } from '@/lib/brand'
import { LoginForm } from '@/app/login/LoginForm'
import { currentUser } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Sign in',
  description: `Sign in to ${brand.name} to track orders and save recipients.`,
  robots: { index: false, follow: false },
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; idle?: string }>
}) {
  const { next, idle } = await searchParams
  const user = await currentUser()

  if (user) redirect(next ?? '/account')

  return (
    <main>
      <PageHeader
        eyebrow="Account"
        /* Names the site. On a screen that asks for a password, "which
           website is this" is not decoration. */
        title={`Sign in to ${brand.name}`}
        intro="You do not need an account to shop. Sign in to see past orders, save the people you send to, and check out faster next time."
      />

      <section>
        <div className="mx-auto max-w-[86rem] px-gutter py-section">
          {idle && (
            <p
              role="status"
              className="mb-8 max-w-measure border-l-4 border-accent bg-paper-sunk px-5 py-4 text-small"
            >
              You were signed out because nothing happened for 30 minutes. This
              keeps a screen left open in a shop from staying signed in.
            </p>
          )}
          <LoginForm next={next} />
        </div>
      </section>
    </main>
  )
}
