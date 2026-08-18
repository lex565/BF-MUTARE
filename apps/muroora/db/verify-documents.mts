/**
 * Prove document replacement cannot lose somebody's evidence.
 *
 *   npm run db:verify-documents
 *
 * WHY THIS EXISTS. Codex found that replacement was three unprotected steps -
 * upload new, delete old file, delete old row, insert new row - and that a
 * failure at the last one left the applicant with no document, their original
 * evidence already deleted and unrecoverable, and the new file orphaned in the
 * bucket. It also found that two simultaneous uploads produced two rows.
 *
 * These are exactly the failures a pilot surfaces: somebody replaces a blurry
 * ID photo on a bad connection and loses the readable one they already had.
 * So they are provoked deliberately here rather than reasoned about.
 */

import { and, eq, sql } from 'drizzle-orm'
import { createClient } from '@supabase/supabase-js'

import { db } from '@/db/client'
import { users } from '@/db/schema/identity'
import {
  businessApplicationDocuments,
  businessApplications,
} from '@/db/schema/marketplace'
import { uploadDocument } from '@/lib/platform/documents'

let failures = 0
const MARK = '@doccheck.local'
const BUCKET = 'business-verification'

function check(name: string, passed: boolean, detail = '') {
  if (!passed) failures += 1
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`)
}

const storage = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
).storage.from(BUCKET)

/** A tiny valid JPEG-ish payload. Content does not matter, size does not either. */
function fakePhoto(name: string): File {
  return new File([new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 1, 2, 3, 4])], name, {
    type: 'image/jpeg',
  })
}

async function objectExists(path: string): Promise<boolean> {
  const folder = path.split('/').slice(0, -1).join('/')
  const file = path.split('/').pop()!
  const { data } = await storage.list(folder)
  return Boolean(data?.some((o) => o.name === file))
}

async function main() {
  const [applicant] = await db
    .insert(users)
    .values({ fullName: 'Check Docs', email: `docs${MARK}` })
    .returning({ id: users.id })

  const [app] = await db
    .insert(businessApplications)
    .values({
      applicantId: applicant.id,
      providerType: 'INDIVIDUAL_SELLER',
      businessName: 'Check Docs Co',
      status: 'DRAFT',
    })
    .returning({ id: businessApplications.id })

  console.log('--- the first upload')

  await uploadDocument({
    userId: applicant.id,
    applicationId: app.id,
    kind: 'ID_DOCUMENT',
    file: fakePhoto('first.jpg'),
  })

  const [first] = await db
    .select({ path: businessApplicationDocuments.path })
    .from(businessApplicationDocuments)
    .where(
      and(
        eq(businessApplicationDocuments.applicationId, app.id),
        eq(businessApplicationDocuments.kind, 'ID_DOCUMENT'),
      ),
    )

  check('a document row exists', Boolean(first?.path))
  check('and the file is really in the bucket', await objectExists(first.path))
  check(
    'the path leaks no name and no ID number',
    !/[a-z]+\s|national|id-\d/i.test(first.path),
    first.path,
  )

  console.log('\n--- replacing it')

  await uploadDocument({
    userId: applicant.id,
    applicationId: app.id,
    kind: 'ID_DOCUMENT',
    file: fakePhoto('second.jpg'),
  })

  const rows = await db
    .select({ path: businessApplicationDocuments.path })
    .from(businessApplicationDocuments)
    .where(
      and(
        eq(businessApplicationDocuments.applicationId, app.id),
        eq(businessApplicationDocuments.kind, 'ID_DOCUMENT'),
      ),
    )

  check('there is still exactly ONE row', rows.length === 1, `${rows.length} rows`)
  check('and it points at the new file', rows[0].path !== first.path)
  check('the new file is in the bucket', await objectExists(rows[0].path))
  check(
    'and the OLD file was actually deleted',
    !(await objectExists(first.path)),
    'an orphaned ID photo is one nobody knows exists',
  )

  console.log('\n--- two uploads at once')

  const before = rows[0].path

  // The race Codex named. One must lose; neither may produce a second row.
  const results = await Promise.allSettled([
    uploadDocument({
      userId: applicant.id,
      applicationId: app.id,
      kind: 'ID_DOCUMENT',
      file: fakePhoto('race-a.jpg'),
    }),
    uploadDocument({
      userId: applicant.id,
      applicationId: app.id,
      kind: 'ID_DOCUMENT',
      file: fakePhoto('race-b.jpg'),
    }),
  ])

  const afterRace = await db
    .select({ path: businessApplicationDocuments.path })
    .from(businessApplicationDocuments)
    .where(
      and(
        eq(businessApplicationDocuments.applicationId, app.id),
        eq(businessApplicationDocuments.kind, 'ID_DOCUMENT'),
      ),
    )

  check(
    'still exactly ONE row after a simultaneous replace',
    afterRace.length === 1,
    `${afterRace.length} rows, ${results.filter((r) => r.status === 'fulfilled').length} succeeded`,
  )
  check('and the row points somewhere real', await objectExists(afterRace[0].path))
  check('the pre-race file is gone', !(await objectExists(before)))

  console.log('\n--- photographs are allowed to be plural')

  for (const n of ['a', 'b', 'c']) {
    await uploadDocument({
      userId: applicant.id,
      applicationId: app.id,
      kind: 'PROPERTY_PHOTO',
      file: fakePhoto(`room-${n}.jpg`),
    })
  }

  const [{ n: photoCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(businessApplicationDocuments)
    .where(
      and(
        eq(businessApplicationDocuments.applicationId, app.id),
        eq(businessApplicationDocuments.kind, 'PROPERTY_PHOTO'),
      ),
    )
  check('three property photos are kept', photoCount === 3, `${photoCount}`)

  console.log('\n--- a decided application accepts nothing more')

  await db
    .update(businessApplications)
    .set({ status: 'APPROVED' })
    .where(eq(businessApplications.id, app.id))

  let refused = false
  try {
    await uploadDocument({
      userId: applicant.id,
      applicationId: app.id,
      kind: 'ID_DOCUMENT',
      file: fakePhoto('too-late.jpg'),
    })
  } catch {
    refused = true
  }
  check('uploading to an approved application is refused', refused)

  /* ------------------------------------------------------------- cleanup */

  const all = await db
    .select({ path: businessApplicationDocuments.path })
    .from(businessApplicationDocuments)
    .where(eq(businessApplicationDocuments.applicationId, app.id))

  if (all.length) await storage.remove(all.map((d) => d.path))
  await db
    .delete(businessApplicationDocuments)
    .where(eq(businessApplicationDocuments.applicationId, app.id))
  await db.delete(businessApplications).where(eq(businessApplications.id, app.id))
  await db.delete(users).where(sql`${users.email} LIKE ${'%' + MARK}`)

  const { data: leftovers } = await storage.list(app.id)
  check(
    'no test files left in the bucket',
    !leftovers || leftovers.length === 0,
    `${leftovers?.length ?? 0} left`,
  )

  console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
  process.exitCode = failures === 0 ? 0 : 1
}

await main()
process.exit(process.exitCode ?? 0)
