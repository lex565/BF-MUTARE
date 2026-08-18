/**
 * Prove the beta distribution behaves, including the parts that must refuse.
 *
 *   npm run db:verify-releases
 *
 * The one that matters is BLOCKING. Every APK before 0.2.0 contains an
 * authentication bypass and could not be withdrawn, because the link had been
 * pasted into messages. The whole point of this system is that a build can be
 * taken down, so that is what gets tested hardest.
 */

import { and, eq, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { mobileReleases, betaFeedback } from '@/db/schema/releases'
import { encode as qrEncode } from '@/app/beta/QrCode'
import {
  checkAppVersion,
  compareVersions,
  currentRelease,
  publicBetaEnabled,
  submitBetaFeedback,
  listBetaFeedback,
} from '@/lib/platform/releases'

let failures = 0

function check(name: string, passed: boolean, detail = '') {
  if (!passed) failures += 1
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`)
}

async function refused(fn: () => Promise<unknown>): Promise<boolean> {
  try {
    await fn()
    return false
  } catch {
    return true
  }
}

const TEST_VERSION = '0.0.1-check'

async function main() {
  console.log('--- version comparison')

  check('0.1.0 is older than 0.2.0', compareVersions('0.1.0', '0.2.0') < 0)
  check('0.2.0 equals 0.2.0', compareVersions('0.2.0', '0.2.0') === 0)
  check('0.10.0 is NEWER than 0.9.0', compareVersions('0.10.0', '0.9.0') > 0)
  check('0.2 equals 0.2.0', compareVersions('0.2', '0.2.0') === 0)
  check('1.0.0 beats 0.99.99', compareVersions('1.0.0', '0.99.99') > 0)

  console.log('\n--- what is actually published')

  const android = await currentRelease('ANDROID')
  check('an Android build is published', android !== null)
  check(
    'it has somewhere to download from',
    Boolean(android?.downloadUrl),
    android?.downloadUrl?.slice(0, 40),
  )
  check('the beta page is open', await publicBetaEnabled())
  console.log(`        current version: ${android?.version}`)

  console.log('\n--- the database refuses a broken release')

  // A PUBLISHED row with no URL is a download button that 404s.
  check(
    'publishing with no download link is refused',
    await refused(() =>
      db.insert(mobileReleases).values({
        platform: 'ANDROID',
        version: TEST_VERSION,
        status: 'PUBLISHED',
      }),
    ),
  )

  // Blocking without a reason leaves testers with a dead app and no words.
  check(
    'blocking with no reason is refused',
    await refused(() =>
      db.insert(mobileReleases).values({
        platform: 'ANDROID',
        version: TEST_VERSION,
        status: 'BLOCKED',
      }),
    ),
  )

  // Two published Android builds means /beta/android has to guess.
  check(
    'a second published Android build is refused',
    await refused(() =>
      db.insert(mobileReleases).values({
        platform: 'ANDROID',
        version: TEST_VERSION,
        downloadUrl: 'https://example.invalid/x.apk',
        status: 'PUBLISHED',
      }),
    ),
  )

  console.log('\n--- what the app is told')

  const current = android?.version ?? '0.2.0'

  const onCurrent = await checkAppVersion({ platform: 'ANDROID', version: current })
  check('the current version is left alone', onCurrent.ok && !onCurrent.updateRequired)
  check('and is not nagged to update', !onCurrent.updateAvailable)

  // 0.1.0 is below min_supported_version 0.2.0 - it is a bypass build.
  const old = await checkAppVersion({ platform: 'ANDROID', version: '0.1.0' })
  check('an old build is REFUSED, not merely nudged', old.updateRequired)
  check('and is told where to get the current one', Boolean(old.downloadUrl))
  console.log(`        "${old.message}"`)

  // An unknown version must be treated as too old, never as fine.
  const unknown = await checkAppVersion({ platform: 'ANDROID', version: '0.0.9' })
  check('an unrecognised old version is refused', unknown.updateRequired)

  console.log('\n--- blocking a build takes it out of circulation')

  const [blocked] = await db
    .insert(mobileReleases)
    .values({
      platform: 'ANDROID',
      version: TEST_VERSION,
      downloadUrl: 'https://example.invalid/blocked.apk',
      status: 'BLOCKED',
      blockedReason: 'Check: this build is not safe to keep using.',
    })
    .returning({ id: mobileReleases.id })

  const onBlocked = await checkAppVersion({
    platform: 'ANDROID',
    version: TEST_VERSION,
  })
  check('a blocked build is refused', onBlocked.updateRequired && !onBlocked.ok)
  check(
    'and the reason reaches the person running it',
    onBlocked.message.includes('not safe to keep using'),
  )

  console.log('\n--- iOS says so honestly')

  const ios = await currentRelease('IOS')
  check('no iOS build is published', ios === null)

  const [iosRow] = await db
    .select({ url: mobileReleases.downloadUrl, status: mobileReleases.status })
    .from(mobileReleases)
    .where(eq(mobileReleases.platform, 'IOS'))

  check('the iOS row is COMING_SOON', iosRow?.status === 'COMING_SOON')
  check('and NO TestFlight URL was invented', iosRow?.url === null)

  console.log('\n--- security reports stay private')

  await submitBetaFeedback({
    kind: 'SECURITY',
    message: 'Check: pretend exploit report, safe to delete.',
    appVersion: TEST_VERSION,
  })
  await submitBetaFeedback({
    kind: 'BUG',
    message: 'Check: pretend ordinary bug, safe to delete.',
    appVersion: TEST_VERSION,
  })

  const withoutSecurity = await listBetaFeedback(false)
  const withSecurity = await listBetaFeedback(true)

  check(
    'a security report is hidden without the permission',
    !withoutSecurity.some((f) => f.isSecurity),
  )
  check(
    'and visible with it',
    withSecurity.some((f) => f.isSecurity),
  )

  // Feedback from somebody NOT signed in must be accepted - the most valuable
  // report a beta gets is "I cannot sign in".
  check(
    'anonymous feedback is accepted',
    withSecurity.some((f) => f.userId === null),
  )

  console.log('\n--- the QR code carries the right address')

  /**
   * Decode our own output.
   *
   * Chrome's BarcodeDetector is disabled on this desktop build, so a real
   * scanner cannot be pointed at it here. What CAN be proved is that the
   * payload survives the parts most likely to be wrong in a hand-written
   * encoder: module placement, the mask, and block interleaving. Reversing all
   * three and recovering the original bytes exercises exactly that path.
   *
   * It does not prove the finder patterns or format bits are spec-correct -
   * those are fixed constants, and 0x5412 is the documented value for level M
   * with mask 0. The URL is printed under the code on the page regardless, so
   * a scanner that dislikes it costs convenience and never correctness.
   */
  function decodePayload(text: string): string | null {
    const code = qrEncode(text)
    if (!code) return null
    const { size, modules } = code

    // Rebuild the reserved map exactly as the encoder did, so the reader walks
    // the same cells in the same order.
    const reserved: boolean[][] = Array.from({ length: size }, () =>
      new Array<boolean>(size).fill(false),
    )
    const block = (r0: number, c0: number, h: number, w: number) => {
      for (let r = r0; r < r0 + h; r += 1)
        for (let c = c0; c < c0 + w; c += 1)
          if (r >= 0 && r < size && c >= 0 && c < size) reserved[r][c] = true
    }
    block(0, 0, 9, 9)
    block(0, size - 8, 9, 8)
    block(size - 8, 0, 8, 9)
    for (let i = 0; i < size; i += 1) {
      reserved[6][i] = true
      reserved[i][6] = true
    }
    const version = (size - 17) / 4
    const centres = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34]][version] as number[]
    for (const r of centres)
      for (const c of centres) {
        if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue
        block(r - 2, c - 2, 5, 5)
      }

    const bits: number[] = []
    let upward = true
    for (let col = size - 1; col > 0; col -= 2) {
      if (col === 6) col -= 1
      for (let i = 0; i < size; i += 1) {
        const row = upward ? size - 1 - i : i
        for (let k = 0; k < 2; k += 1) {
          const c = col - k
          if (reserved[row][c]) continue
          // Undo mask 0.
          bits.push((modules[row][c] !== ((row + c) % 2 === 0)) ? 1 : 0)
        }
      }
      upward = !upward
    }

    const codewords: number[] = []
    for (let i = 0; i + 8 <= bits.length; i += 8) {
      codewords.push(parseInt(bits.slice(i, i + 8).join(''), 2))
    }

    // De-interleave the data half. Every version used here has equal-sized
    // blocks, so the weave is a simple round robin.
    const TABLE: Record<number, [number, number]> = {
      1: [16, 1], 2: [28, 1], 3: [44, 1], 4: [64, 2], 5: [86, 2], 6: [108, 4],
    }
    const [totalData, blocks] = TABLE[version]
    const per = totalData / blocks
    const data = new Array<number>(totalData)
    let at = 0
    for (let i = 0; i < per; i += 1)
      for (let b = 0; b < blocks; b += 1) data[b * per + i] = codewords[at++]

    // Mode nibble, then an 8-bit length, then the bytes.
    if ((data[0] >> 4) !== 0b0100) return null
    const length = ((data[0] & 0x0f) << 4) | (data[1] >> 4)
    const out: number[] = []
    for (let i = 0; i < length; i += 1) {
      out.push(((data[1 + i] & 0x0f) << 4) | (data[2 + i] >> 4))
    }
    return new TextDecoder().decode(new Uint8Array(out))
  }

  for (const url of [
    'https://musuwo.online/beta/android',
    'https://musuwo.vercel.app/beta/android',
    'https://muroora-mart.vercel.app/beta/android',
  ]) {
    check(`QR round-trips ${url.length} chars`, decodePayload(url) === url, url)
  }

  check(
    'an over-long value draws nothing rather than a bad code',
    qrEncode('x'.repeat(400)) === null,
  )

  /* ------------------------------------------------------------- cleanup */

  await db.delete(mobileReleases).where(eq(mobileReleases.id, blocked.id))
  await db
    .delete(betaFeedback)
    .where(sql`${betaFeedback.message} LIKE 'Check: pretend%'`)

  const [{ n: leftRel }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(mobileReleases)
    .where(eq(mobileReleases.version, TEST_VERSION))
  const [{ n: leftFb }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(betaFeedback)
    .where(sql`${betaFeedback.message} LIKE 'Check: pretend%'`)

  check('cleaned up after itself', leftRel === 0 && leftFb === 0)

  // The real published build must be untouched by any of the above.
  const stillThere = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(mobileReleases)
    .where(
      and(eq(mobileReleases.platform, 'ANDROID'), eq(mobileReleases.status, 'PUBLISHED')),
    )
  check('the real published build survived', stillThere[0].n === 1)

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
  process.exitCode = failures === 0 ? 0 : 1
}

await main()
process.exit(process.exitCode ?? 0)
