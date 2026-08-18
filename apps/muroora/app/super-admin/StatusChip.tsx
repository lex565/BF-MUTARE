/**
 * A status, coloured by what it means rather than by where it sits.
 *
 * Green is "live or settled", amber is "somebody is waiting", red is "stopped
 * or refused", blue-grey is "nothing is happening yet". The mapping is here in
 * one place so two screens can never disagree about whether PILOT is good news.
 */
const TONE: Record<string, string> = {
  DRAFT: 'cc-chip-idle',
  SUBMITTED: 'cc-chip-wait',
  UNDER_REVIEW: 'cc-chip-wait',
  NEEDS_INFORMATION: 'cc-chip-wait',
  APPROVED: 'cc-chip-ok',
  PILOT: 'cc-chip-ok',
  ACTIVE: 'cc-chip-ok',
  PAUSED: 'cc-chip-idle',
  SUSPENDED: 'cc-chip-stop',
  REJECTED: 'cc-chip-stop',
  INACTIVE: 'cc-chip-idle',
}

/** SUBMITTED -> "Submitted". Read by people, not by machines. */
export function humanise(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase().replace(/_/g, ' ')
}

export function StatusChip({ status }: { status: string }) {
  return (
    <span className={`cc-chip ${TONE[status] ?? 'cc-chip-idle'}`}>
      {humanise(status)}
    </span>
  )
}
