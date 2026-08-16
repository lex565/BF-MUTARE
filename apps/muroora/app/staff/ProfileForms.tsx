'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'

import {
  changeMyPasswordAction,
  updateMyProfileAction,
  uploadMyPhotoAction,
  type ProfileState,
} from '@/app/staff/actions'

const field =
  'mt-1 w-full border border-rule bg-paper px-3 py-2 text-small focus:border-accent focus:outline-none'
const label =
  'block font-mono text-micro uppercase tracking-label text-ink-faint'

function Submit({ label: text }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-ink px-5 py-2 font-mono text-micro uppercase tracking-label transition-colors hover:bg-ink hover:text-paper disabled:opacity-50"
    >
      {pending ? '…' : text}
    </button>
  )
}

/**
 * The photo upload.
 *
 * Shown prominently and on its own when it is missing, because until it is
 * there the staff tools stay shut - so it is not a settings field, it is the
 * thing standing between them and their work.
 */
export function PhotoForm({ hasPhoto }: { hasPhoto: boolean }) {
  const [state, formAction] = useActionState<ProfileState, FormData>(
    uploadMyPhotoAction,
    {},
  )

  return (
    <form action={formAction} className="mt-4 space-y-4">
      <label className="block">
        <span className={label}>
          {hasPhoto ? 'Replace your photo' : 'Your photo'}
        </span>
        <input
          type="file"
          name="photo"
          accept="image/jpeg,image/png,image/webp"
          capture="user"
          required
          className="mt-2 block w-full text-small file:mr-4 file:border file:border-ink file:bg-paper file:px-4 file:py-2 file:font-mono file:text-micro file:uppercase file:tracking-label"
        />
        <span className="mt-2 block text-small text-ink-faint">
          A clear photo of your face, as it would appear on an ID card. JPG,
          PNG or WEBP, up to 5MB. It is kept privately and is never shown on
          the public site.
        </span>
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <Submit label={hasPhoto ? 'Replace photo' : 'Save photo'} />
        {state.error && (
          <p role="alert" className="text-small text-accent">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="text-small text-support">
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}

export function PasswordForm() {
  const [state, formAction] = useActionState<ProfileState, FormData>(
    changeMyPasswordAction,
    {},
  )

  return (
    <form action={formAction} className="mt-4 max-w-md space-y-5">
      <label className="block">
        <span className={label}>New password</span>
        <input
          type="password"
          name="password"
          required
          minLength={10}
          autoComplete="new-password"
          className={field}
        />
        <span className="mt-2 block text-small text-ink-faint">
          At least 10 characters. Three ordinary words you will remember beat
          one short word with symbols in it.
        </span>
      </label>

      <label className="block">
        <span className={label}>Type it again</span>
        <input
          type="password"
          name="confirm"
          required
          autoComplete="new-password"
          className={field}
        />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <Submit label="Change password" />
        {state.error && (
          <p role="alert" className="text-small text-accent">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="text-small text-support">
            {state.message}
          </p>
        )}
      </div>
    </form>
  )
}

export function ProfileForm({
  fullName,
  phone,
  jobTitle,
}: {
  fullName: string
  phone: string
  jobTitle: string
}) {
  const [state, formAction] = useActionState<ProfileState, FormData>(
    updateMyProfileAction,
    {},
  )

  return (
    <form action={formAction} className="mt-4 max-w-2xl space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block">
          <span className={label}>Your name</span>
          <input name="fullName" defaultValue={fullName} required className={field} />
        </label>
        <label className="block">
          <span className={label}>Phone</span>
          <input
            name="phone"
            defaultValue={phone}
            inputMode="tel"
            placeholder="0771234567"
            className={field}
          />
        </label>
      </div>

      <label className="block">
        <span className={label}>What you do here</span>
        <input
          name="jobTitle"
          defaultValue={jobTitle}
          placeholder="e.g. Shop assistant"
          className={field}
        />
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <Submit label="Save" />
        {state.error && (
          <p role="alert" className="text-small text-accent">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="text-small text-support">
            {state.message}
          </p>
        )}
      </div>

      <p className="text-small text-ink-faint">
        You cannot change your own access or staff number here - those belong
        to an admin.
      </p>
    </form>
  )
}
