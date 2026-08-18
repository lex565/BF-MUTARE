/**
 * Prove the sign-up email gate lets the right things through and stops the
 * right things.
 *
 *   npm run db:verify-email
 *
 * It does real DNS, on purpose. The list half of the check can be reasoned
 * about by reading it; the MX half cannot, and the failure mode that matters -
 * refusing a real customer because a lookup was slow - only shows up against a
 * real resolver.
 *
 * IT POINTS AT PUBLIC RESOLVERS, AND ONLY THIS FILE DOES.
 *
 * This machine's configured nameserver is 127.0.0.1 - a local proxy that is
 * usually not running - so every lookup here comes back ECONNREFUSED. The
 * library treats that as inconclusive and lets the address through, which is
 * the correct behaviour and is separately checked below, but it also means the
 * real branches would never be exercised on this machine and a genuine bug in
 * them could sit undetected.
 *
 * The library itself deliberately does NOT do this. Hard-coding Google's
 * nameservers into the running application would send every customer's email
 * domain to a third party on every sign-up, and would ignore whatever resolver
 * the platform provides. Vercel's works; this laptop's does not.
 */

import { setServers } from 'node:dns'

import {
  checkSignUpEmail,
  domainCanReceiveMail,
  isDisposableDomain,
} from '@/lib/email-policy'

setServers(['8.8.8.8', '1.1.1.1'])

let failures = 0

function check(name: string, actual: boolean, expected: boolean) {
  const ok = actual === expected
  if (!ok) failures += 1
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
}

async function main() {
  console.log('--- the list, offline and definitive')

  for (const domain of [
    'mailinator.com',
    'yopmail.com',
    '10minutemail.com',
    'guerrillamail.net',
    'dayrep.com',
  ]) {
    check(`${domain} is disposable`, isDisposableDomain(domain), true)
  }

  // The reason the matcher walks parents rather than comparing whole strings.
  check(
    'a subdomain of a listed service is caught',
    isDisposableDomain('anything.you.like.mailinator.com'),
    true,
  )

  for (const domain of [
    'gmail.com',
    'outlook.com',
    'yahoo.com',
    'zol.co.zw',
    'buaa.edu.cn',
    'musuwo.co.zw',
  ]) {
    check(`${domain} is not disposable`, isDisposableDomain(domain), false)
  }

  // A one-label string must never match something it merely ends with.
  check('a bare suffix does not match', isDisposableDomain('com'), false)

  console.log('\n--- MX lookups (against 8.8.8.8 / 1.1.1.1, see the note above)')

  check(
    'gmail.com accepts mail',
    await domainCanReceiveMail('gmail.com'),
    true,
  )
  check(
    'a domain that does not exist is refused',
    await domainCanReceiveMail('this-domain-does-not-exist-9f3a2b.invalid'),
    false,
  )

  /**
   * The fail-open promise, proved rather than asserted.
   *
   * A resolver that refuses the connection must let the address THROUGH. This
   * is the branch that decides whether a DNS outage costs the shop one
   * throwaway registration or every registration, so it is checked directly
   * by pointing at a port with nothing behind it, not inferred from the code.
   */
  setServers(['127.0.0.1:9'])
  check(
    'an unreachable resolver lets the address through',
    await domainCanReceiveMail('gmail.com'),
    true,
  )
  setServers(['8.8.8.8', '1.1.1.1'])

  console.log('\n--- the gate as sign-up calls it')

  const cases: Array<[string, boolean]> = [
    ['tanakambendanata@gmail.com', true],
    ['someone@outlook.com', true],
    ['throwaway@mailinator.com', false],
    ['burner@yopmail.com', false],
    ['typo@gmial-not-a-real-domain-8827.com', false],
    ['not-an-email', false],
  ]

  for (const [email, expected] of cases) {
    const verdict = await checkSignUpEmail(email)
    check(`${email} -> ${expected ? 'allowed' : 'refused'}`, verdict.ok, expected)
    if (!verdict.ok) console.log(`        "${verdict.reason}"`)
  }

  console.log(
    failures === 0
      ? '\nAll checks passed.'
      : `\n${failures} check(s) FAILED.`,
  )
  process.exitCode = failures === 0 ? 0 : 1
}

void main()
