/**
 * Prove that starting is easy and submitting is not.
 *
 *   npm run db:verify-registration
 *
 * The check that matters: an application missing a mandatory item must be
 * REFUSED by the server, whatever the form believed. The submit button being
 * disabled is a courtesy; a server action is a public endpoint and anybody
 * signed in can call it with any payload.
 */

import { eq, sql } from 'drizzle-orm'

import { db } from '@/db/client'
import { users } from '@/db/schema/identity'
import {
  businessApplicationDocuments,
  businessApplicationEvents,
  businessApplications,
} from '@/db/schema/marketplace'
import {
  RegistrationError,
  readiness,
  saveDraft,
  startApplication,
  submitApplication,
  requirementsFor,
} from '@/lib/platform/registration'
import { PROVIDER_TYPES } from '@/lib/platform/provider-types'

let failures = 0
const MARK = '@regcheck.local'

function check(name: string, passed: boolean, detail = '') {
  if (!passed) failures += 1
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`)
}

async function refusedWith(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn()
    return null
  } catch (error) {
    return error instanceof RegistrationError ? error.message : String(error)
  }
}

async function main() {
  console.log('--- every provider type has requirements')

  for (const t of PROVIDER_TYPES) {
    const rows = await requirementsFor(t.value)
    const mandatory = rows.filter((r) => r.isMandatory)
    check(
      `${t.value} has mandatory requirements`,
      mandatory.length > 0,
      `${mandatory.length} of ${rows.length}`,
    )
  }

  // The heaviest identity rules belong on the person trading alone, because
  // there is no company behind them to be accountable.
  const individual = await requirementsFor('INDIVIDUAL_SELLER')
  const keys = new Set(individual.map((r) => r.requirement))
  check('an individual must show an ID', keys.has('id_document'))
  check('and a photo holding that ID', keys.has('id_selfie'))
  check('and address evidence', keys.has('address_evidence'))

  const registered = await requirementsFor('REGISTERED_BUSINESS')
  const regKeys = new Set(registered.map((r) => r.requirement))
  check('a registered company must show its certificate', regKeys.has('registration_document'))
  check(
    'and is NOT asked for a holding-ID photo',
    !regKeys.has('id_selfie'),
    'the register is the accountability',
  )

  console.log('\n--- starting is easy')

  const [applicant] = await db
    .insert(users)
    .values({ fullName: 'Check Applicant', email: `reg${MARK}` })
    .returning({ id: users.id })

  const app = await startApplication({
    userId: applicant.id,
    providerType: 'INDIVIDUAL_SELLER',
  })

  check('an application starts with no documents at all', Boolean(app.id))
  check('and it is a DRAFT', app.status === 'DRAFT')
  check('with draftStartedAt recorded', app.draftStartedAt !== null)
  check(
    'and submittedAt still empty',
    app.submittedAt === null,
    'a draft must not sit in the review queue',
  )

  // Choosing again must not create a second one.
  const again = await startApplication({
    userId: applicant.id,
    providerType: 'INFORMAL_BUSINESS',
  })
  check('choosing a different type reuses the same draft', again.id === app.id)
  check('and changes the type', again.providerType === 'INFORMAL_BUSINESS')

  const [{ n: draftCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(businessApplications)
    .where(eq(businessApplications.applicantId, applicant.id))
  check('exactly one application exists for this person', draftCount === 1)

  console.log('\n--- submitting is not')

  const empty = await readiness(app.id)
  check('an empty draft cannot be submitted', !empty.canSubmit)
  check('and says what is missing', empty.missing.length > 0, `${empty.missing.length} items`)

  const refusal = await refusedWith(() =>
    submitApplication({ userId: applicant.id, applicationId: app.id }),
  )
  check('THE SERVER REFUSES IT, not just the button', refusal !== null)
  console.log(`        "${refusal?.slice(0, 120)}"`)

  const [afterRefusal] = await db
    .select({ status: businessApplications.status })
    .from(businessApplications)
    .where(eq(businessApplications.id, app.id))
  check('and the status did not move', afterRefusal.status === 'DRAFT')

  console.log('\n--- filling it in, one piece at a time')

  await saveDraft({
    userId: applicant.id,
    applicationId: app.id,
    fields: {
      businessName: 'Check Bakery',
      summary: 'Bread and buns, baked every morning.',
      kind: 'FOOD',
      city: 'Mutare',
      contactPhone: '+263770000000',
      legalName: 'Check Applicant',
      idType: 'NATIONAL_ID',
      idNumber: '63-000000A00',
      residentialAddress: '14 Check Street, Sakubva',
      addressEvidenceType: 'LEASE',
      operatingArea: 'Sakubva',
    },
  })

  const typed = await readiness(app.id)
  const stillMissing = new Set(typed.missing.map((m) => m.requirement))
  check('the typed answers are now ticked off', !stillMissing.has('legal_name'))
  check('but the ID photo is still required', stillMissing.has('id_document'))
  check('and the holding-ID photo too', stillMissing.has('id_selfie'))
  check(
    'address evidence needs the FILE, not just the type',
    stillMissing.has('address_evidence'),
    'the type was chosen but nothing uploaded',
  )
  check('so it still cannot be submitted', !typed.canSubmit)

  // Stand in for the uploads. The upload path itself writes exactly these rows;
  // what is being proved here is that the GATE reads them.
  for (const kind of ['ID_DOCUMENT', 'ID_SELFIE', 'PROOF_OF_ADDRESS']) {
    await db.insert(businessApplicationDocuments).values({
      applicationId: app.id,
      uploadedBy: applicant.id,
      kind,
      path: `${app.id}/${kind}-check.jpg`,
      mimeType: 'image/jpeg',
      sizeBytes: 1024,
    })
  }

  const ready = await readiness(app.id)
  check('with the documents in, it is ready', ready.canSubmit, `${ready.missing.length} missing`)

  console.log('\n--- and only then does it go')

  await submitApplication({ userId: applicant.id, applicationId: app.id })

  const [sent] = await db
    .select({ status: businessApplications.status, submittedAt: businessApplications.submittedAt })
    .from(businessApplications)
    .where(eq(businessApplications.id, app.id))

  check('the status is SUBMITTED', sent.status === 'SUBMITTED')
  check('and submittedAt is set', sent.submittedAt !== null)

  const events = await db
    .select({ event: businessApplicationEvents.event })
    .from(businessApplicationEvents)
    .where(eq(businessApplicationEvents.applicationId, app.id))
  check('and it is in the history', events.some((e) => e.event === 'SUBMITTED'))

  console.log('\n--- an applicant cannot approve themselves')

  // Submitting twice must not move it further along.
  const twice = await refusedWith(() =>
    submitApplication({ userId: applicant.id, applicationId: app.id }),
  )
  check('submitting a second time is refused', twice !== null)

  const [stranger] = await db
    .insert(users)
    .values({ fullName: 'Check Stranger', email: `stranger${MARK}` })
    .returning({ id: users.id })

  const notYours = await refusedWith(() =>
    saveDraft({
      userId: stranger.id,
      applicationId: app.id,
      fields: { businessName: 'Hijacked' },
    }),
  )
  check('somebody else cannot edit this application', notYours !== null)
  check(
    'and is told "no such application", not "not yours"',
    notYours?.includes('No such application') === true,
    'confirming it exists is information they should not have',
  )

  const [unchanged] = await db
    .select({ name: businessApplications.businessName })
    .from(businessApplications)
    .where(eq(businessApplications.id, app.id))
  check('and nothing changed', unchanged.name === 'Check Bakery')

  /* ------------------------------------------------------------- cleanup */

  await db.delete(businessApplicationDocuments).where(eq(businessApplicationDocuments.applicationId, app.id))
  await db.delete(businessApplications).where(eq(businessApplications.id, app.id))
  await db.delete(users).where(sql`${users.email} LIKE ${'%' + MARK}`)

  const [{ n: left }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(users)
    .where(sql`${users.email} LIKE ${'%' + MARK}`)
  check('cleaned up after itself', left === 0)

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
  process.exitCode = failures === 0 ? 0 : 1
}

await main()
process.exit(process.exitCode ?? 0)
