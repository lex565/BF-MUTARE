/**
 * Staff layer verification.
 *
 * Same discipline as db/verify.mjs: prove the rules by breaking them. A test
 * that only does the allowed thing proves nothing - every check below tries the
 * thing that must be refused, and fails loudly if it is allowed.
 *
 *   npm run db:verify-staff
 *
 * Cleans up after itself. Never touches a real staff record: every account it
 * makes carries the VERIFY_TAG and is deleted at the end, and the run aborts
 * before writing anything if a leftover from a previous run is found.
 */

import postgres from 'postgres'

const sql = postgres(process.env.DIRECT_URL, { max: 1, prepare: false })
const STORE_ID = process.env.NEXT_PUBLIC_STORE_ID

const VERIFY_TAG = 'verify-staff@invalid.test'

let passed = 0
let failed = 0

const ok = (what) => {
  passed++
  console.log(`  PASS  ${what}`)
}
const bad = (what, detail) => {
  failed++
  console.log(`  FAIL  ${what}`)
  if (detail) console.log(`        ${detail}`)
}

/** Runs a statement that MUST be rejected. */
async function mustRefuse(what, fn, expect) {
  try {
    await fn()
    bad(what, 'it was allowed')
  } catch (error) {
    if (expect && !String(error.message).includes(expect)) {
      bad(what, `refused, but for the wrong reason: ${error.message}`)
    } else {
      ok(what)
    }
  }
}

/** Runs a statement that must succeed. */
async function mustAllow(what, fn) {
  try {
    const result = await fn()
    ok(what)
    return result
  } catch (error) {
    bad(what, error.message)
    return null
  }
}

console.log('\nStaff layer - verifying by trying to break it\n')

if (!STORE_ID) {
  console.error('NEXT_PUBLIC_STORE_ID is not set. Aborting.')
  process.exit(1)
}

/* ------------------------------------------------- 0. refuse to run dirty */

const leftovers = await sql`
  SELECT id FROM users WHERE email LIKE ${'%' + VERIFY_TAG}
`
if (leftovers.length > 0) {
  console.error(
    `Found ${leftovers.length} leftover test account(s) from a previous run.\n` +
      `Delete them first - this script will not write over an unknown state.`,
  )
  await sql.end()
  process.exit(1)
}

const realAdmins = await sql`
  SELECT count(*)::int AS n FROM user_roles
  WHERE role = 'ADMIN' AND store_id = ${STORE_ID}
`
console.log(`  note  ${realAdmins[0].n} real admin account(s) already exist\n`)

let a, b

try {
  /* --------------------------------------------- 1. staff numbers are safe */

  console.log('Staff numbers')

  a = (
    await sql`
      INSERT INTO users (email, full_name) VALUES (${'a.' + VERIFY_TAG}, 'Verify A')
      RETURNING id
    `
  )[0].id
  b = (
    await sql`
      INSERT INTO users (email, full_name) VALUES (${'b.' + VERIFY_TAG}, 'Verify B')
      RETURNING id
    `
  )[0].id

  const pa = await mustAllow('a profile gets a number without being given one', () =>
    sql`
      INSERT INTO staff_profiles (store_id, user_id, job_title)
      VALUES (${STORE_ID}, ${a}, 'Verify')
      RETURNING staff_number
    `,
  )

  const pb = await sql`
    INSERT INTO staff_profiles (store_id, user_id, job_title)
    VALUES (${STORE_ID}, ${b}, 'Verify')
    RETURNING staff_number
  `

  if (pa && pa[0].staff_number !== pb[0].staff_number) {
    ok(`two profiles get different numbers (${pa[0].staff_number} / ${pb[0].staff_number})`)
  } else {
    bad('two profiles get different numbers', 'they collided')
  }

  if (/^MM-STF-\d{4,}$/.test(pb[0].staff_number)) {
    ok(`the number is in the MM-STF-0000 format (${pb[0].staff_number})`)
  } else {
    bad('the number format', pb[0].staff_number)
  }

  await mustRefuse(
    'the same number cannot be given to two people',
    () => sql`
      UPDATE staff_profiles SET staff_number = ${pa[0].staff_number}
      WHERE user_id = ${b}
    `,
    'staff_profiles_staff_number_unique',
  )

  await mustRefuse(
    'one person cannot have two staff profiles',
    () => sql`
      INSERT INTO staff_profiles (store_id, user_id) VALUES (${STORE_ID}, ${a})
    `,
    'staff_profiles_user_id_unique',
  )

  /* ------------------------------------------- 2. status and date agree */

  console.log('\nStatus and dates cannot disagree')

  await mustRefuse(
    'LEFT without a leaving date is refused',
    () => sql`UPDATE staff_profiles SET status = 'LEFT' WHERE user_id = ${a}`,
    'staff_left_date_matches_status',
  )

  await mustRefuse(
    'a leaving date on somebody still working is refused',
    () => sql`UPDATE staff_profiles SET left_at = now() WHERE user_id = ${a}`,
    'staff_left_date_matches_status',
  )

  await mustAllow(
    'LEFT with a leaving date is accepted',
    () => sql`
      UPDATE staff_profiles SET status = 'LEFT', left_at = now()
      WHERE user_id = ${a}
    `,
  )

  await mustAllow(
    'coming back clears the leaving date',
    () => sql`
      UPDATE staff_profiles SET status = 'ACTIVE', left_at = NULL
      WHERE user_id = ${a}
    `,
  )

  await mustRefuse(
    'an invented status is refused',
    () => sql`UPDATE staff_profiles SET status = 'FIRED' WHERE user_id = ${a}`,
  )

  /* ------------------------------------ 3. roles and profiles stay apart */

  console.log('\nAccess and employment record are separate')

  await sql`
    INSERT INTO user_roles (user_id, role, store_id)
    VALUES (${a}, 'SHOP_STAFF', ${STORE_ID})
  `

  await sql`
    DELETE FROM user_roles WHERE user_id = ${a} AND role = 'SHOP_STAFF'
  `

  const stillThere = await sql`
    SELECT staff_number FROM staff_profiles WHERE user_id = ${a}
  `
  if (stillThere.length === 1) {
    ok('removing access keeps the employment record')
  } else {
    bad('removing access keeps the employment record', 'the record vanished')
  }

  const roleGone = await sql`
    SELECT 1 FROM user_roles WHERE user_id = ${a} AND role = 'SHOP_STAFF'
  `
  if (roleGone.length === 0) {
    ok('and the access really is gone')
  } else {
    bad('and the access really is gone', 'the role survived')
  }

  await mustRefuse(
    'a profile cannot point at a user who does not exist',
    () => sql`
      INSERT INTO staff_profiles (store_id, user_id)
      VALUES (${STORE_ID}, '00000000-0000-0000-0000-000000000000')
    `,
    'staff_profiles_user_id_users_id_fk',
  )

  await mustRefuse(
    'a profile cannot belong to a store that does not exist',
    () => sql`
      INSERT INTO staff_profiles (store_id, user_id)
      VALUES ('00000000-0000-0000-0000-000000000000', ${b})
    `,
  )

  /* ------------------------------------------------- 4. deleting a person */

  console.log('\nDeleting an account')

  const tmp = (
    await sql`
      INSERT INTO users (email) VALUES (${'c.' + VERIFY_TAG}) RETURNING id
    `
  )[0].id
  await sql`
    INSERT INTO staff_profiles (store_id, user_id) VALUES (${STORE_ID}, ${tmp})
  `
  await sql`DELETE FROM users WHERE id = ${tmp}`
  const orphan = await sql`
    SELECT 1 FROM staff_profiles WHERE user_id = ${tmp}
  `
  if (orphan.length === 0) {
    ok('deleting the account takes its staff profile with it (no orphans)')
  } else {
    bad('deleting the account', 'the profile was left behind')
  }
} finally {
  /* ------------------------------------------------------------- cleanup */
  await sql`DELETE FROM users WHERE email LIKE ${'%' + VERIFY_TAG}`
  const rest = await sql`
    SELECT count(*)::int AS n FROM users WHERE email LIKE ${'%' + VERIFY_TAG}
  `
  console.log(
    `\nCleanup: ${rest[0].n === 0 ? 'all test accounts removed' : `WARNING - ${rest[0].n} left behind`}`,
  )
  await sql.end()
}

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
