import { signedPhotoUrl } from '@/lib/services/staff-photo'

/**
 * A staff photograph.
 *
 * The path is turned into a signed URL HERE, on the server, at render time.
 * The URL lasts five minutes and is never stored — so a page saved or shared
 * carries a link that has already died, and the bucket stays private.
 *
 * Every render writes an audit entry naming who looked. That is deliberate:
 * these are photographs of employees, and a private bucket only means
 * something if opening it leaves a trace.
 *
 * `unoptimized` and a plain <img>: Next's image optimiser would fetch the
 * signed URL from its own cache layer and re-serve it from a stable, public
 * /_next/image path, which quietly undoes the whole arrangement.
 */
export async function StaffPhoto({
  path,
  name,
  viewerId,
  size = 64,
  className = '',
}: {
  path: string | null
  name: string
  viewerId: string
  size?: number
  className?: string
}) {
  const url = path ? await signedPhotoUrl({ path, viewerId }) : null

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  if (!url) {
    return (
      <span
        aria-hidden
        style={{ width: size, height: size }}
        className={`inline-flex shrink-0 items-center justify-center border border-rule bg-paper-sunk font-mono text-ink-faint ${className}`}
      >
        {initials || '—'}
      </span>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={`${name}, Muroora Mart staff`}
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 border border-rule object-cover ${className}`}
    />
  )
}
