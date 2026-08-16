export type AssignmentRider = {
  accountStatus: string
  verificationStatus: string
  availability: string
  currentExposureAmount: bigint
  maxExposureOverrideAmount: bigint | null
  trustExposureLimitAmount: bigint | null
}

export type AssignmentDecision =
  | { allowed: true; resultingExposure: bigint; limit: bigint }
  | {
      allowed: false
      reason: 'NOT_APPROVED' | 'NOT_AVAILABLE' | 'NO_EXPOSURE_LIMIT' | 'EXPOSURE_LIMIT'
      resultingExposure: bigint
      limit: bigint | null
    }

/** Pure policy shared by dispatch and its verification suite. */
export function assignmentDecision(
  rider: AssignmentRider,
  merchandiseValueAmount: bigint,
): AssignmentDecision {
  const resultingExposure = rider.currentExposureAmount + merchandiseValueAmount
  const limit = rider.maxExposureOverrideAmount ?? rider.trustExposureLimitAmount
  if (rider.accountStatus !== 'ACTIVE' || rider.verificationStatus !== 'VERIFIED') {
    return { allowed: false, reason: 'NOT_APPROVED', resultingExposure, limit }
  }
  if (rider.availability !== 'AVAILABLE') {
    return { allowed: false, reason: 'NOT_AVAILABLE', resultingExposure, limit }
  }
  if (limit == null) {
    return { allowed: false, reason: 'NO_EXPOSURE_LIMIT', resultingExposure, limit }
  }
  if (resultingExposure > limit) {
    return { allowed: false, reason: 'EXPOSURE_LIMIT', resultingExposure, limit }
  }
  return { allowed: true, resultingExposure, limit }
}

export function exposureAfterCustodyChange(current: bigint, change: bigint): bigint {
  const result = current + change
  if (result < 0n) throw new RangeError('Rider exposure cannot become negative.')
  return result
}
