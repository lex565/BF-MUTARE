/**
 * Rider policy and security verification. No rows are created: these checks
 * are safe to run repeatedly against a development or CI checkout.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { assignmentDecision, exposureAfterCustodyChange } from '@/lib/services/rider-policy'

let passed = 0
const check = (description: string, test: () => void) => {
  test()
  passed++
  console.log(`  PASS  ${description}`)
}
const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')
const base = {
  accountStatus: 'ACTIVE',
  verificationStatus: 'VERIFIED',
  availability: 'AVAILABLE',
  currentExposureAmount: 1_000n,
  maxExposureOverrideAmount: null,
  trustExposureLimitAmount: 2_500n,
}

console.log('\nRider trust, custody and proof security\n')

check('an application rider cannot receive a delivery', () => {
  assert.equal(assignmentDecision({ ...base, accountStatus: 'APPLICATION' }, 100n).allowed, false)
})
check('a suspended rider cannot receive a delivery', () => {
  assert.equal(assignmentDecision({ ...base, accountStatus: 'SUSPENDED' }, 100n).allowed, false)
})
check('a restricted rider cannot receive a delivery', () => {
  assert.equal(assignmentDecision({ ...base, accountStatus: 'RESTRICTED' }, 100n).allowed, false)
})
check('an offline rider cannot receive a delivery', () => {
  assert.equal(assignmentDecision({ ...base, availability: 'OFFLINE' }, 100n).allowed, false)
})
check('a rider without a configured exposure limit is blocked', () => {
  const result = assignmentDecision({ ...base, trustExposureLimitAmount: null }, 100n)
  assert.deepEqual(result.allowed ? null : result.reason, 'NO_EXPOSURE_LIMIT')
})
check('an assignment above the exposure limit is blocked', () => {
  const result = assignmentDecision(base, 1_501n)
  assert.deepEqual(result.allowed ? null : result.reason, 'EXPOSURE_LIMIT')
})
check('an assignment exactly at the limit is allowed', () => {
  assert.equal(assignmentDecision(base, 1_500n).allowed, true)
})
check('an explicitly configured rider limit overrides the trust tier limit', () => {
  assert.equal(assignmentDecision({ ...base, maxExposureOverrideAmount: 3_000n }, 1_501n).allowed, true)
})
check('custody acquisition increases exposure once by the goods value', () => {
  assert.equal(exposureAfterCustodyChange(1_000n, 500n), 1_500n)
})
check('delivery or return reconciliation decreases exposure', () => {
  assert.equal(exposureAfterCustodyChange(1_500n, -500n), 1_000n)
})
check('a second close cannot drive exposure below zero', () => {
  assert.throws(() => exposureAfterCustodyChange(0n, -500n), RangeError)
})

const proof = source('lib/services/delivery-proof.ts')
const proofRoute = source('app/api/rider/deliveries/[id]/proof/route.ts')
const migration = source('db/migrations/0007_rider_foundation.sql')
const mobile = source('../muroora-mobile/src/RiderFlow.tsx')
const envExample = source('.env.example')

check('OTP uses cryptographic random generation, scrypt and timing-safe comparison', () => {
  assert.match(proof, /randomInt\(0, 1_000_000\)/)
  assert.match(proof, /scryptSync/)
  assert.match(proof, /timingSafeEqual/)
})
check('OTP has a ten-minute expiry, attempt cap and retry throttle', () => {
  assert.match(proof, /OTP_TTL_MS = 10 \* 60 \* 1000/)
  assert.match(proof, /OTP_MAX_ATTEMPTS = 5/)
  assert.match(proof, /OTP_MIN_ATTEMPT_INTERVAL_MS = 3_000/)
})
check('the rider proof API cannot issue or return the secret OTP', () => {
  assert.doesNotMatch(proofRoute, /issueDeliveryOtpForNotification/)
  assert.doesNotMatch(proofRoute, /otpHash/)
})
check('the mobile client contains no pre-filled delivery code', () => {
  assert.doesNotMatch(mobile, /\['2','4','8','1'\]/)
  assert.doesNotMatch(mobile, /defaultValue=\{x\}/)
})
check('sensitive rider verification remains disabled by default', () => {
  assert.match(envExample, /ENABLE_SENSITIVE_RIDER_VERIFICATION=false/)
  assert.match(mobile, /Sensitive verification is currently off/)
})
check('custody, exposure, proof-attempt and earning ledgers are append-only', () => {
  for (const trigger of ['custody_events_immutable', 'rider_exposure_events_immutable', 'delivery_proof_attempts_immutable', 'rider_earning_events_immutable']) {
    assert.match(migration, new RegExp(trigger))
  }
})
check('every new rider-domain table has row-level security enabled', () => {
  for (const table of ['rider_profiles', 'deliveries', 'custody_events', 'delivery_proofs', 'rider_incidents', 'rider_earning_events']) {
    assert.match(migration, new RegExp(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`))
  }
})

console.log(`\n${passed} rider checks passed.\n`)
