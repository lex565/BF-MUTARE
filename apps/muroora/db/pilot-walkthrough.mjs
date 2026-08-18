/**
 * Walk one application from start to approved, so the owner can see every
 * screen with real data instead of a description.
 *
 *   npm run pilot:walk            create it, up to SUBMITTED
 *   npm run pilot:walk -- approve  approve it, which creates the business
 *   npm run pilot:walk -- remove   take all of it back out
 *
 * WHAT IT MAKES. One application in the review queue, owned by the platform
 * owner's own account, so that after `approve` a business workspace appears on
 * their /account page and can actually be clicked around.
 *
 * EVERYTHING IT CREATES IS MARKED AND REMOVABLE. The business slug begins
 * `pilot-walkthrough-`, so `remove` finds it without guessing and cannot touch
 * a real merchant. It is a demonstration, not seed data, and it should be
 * removed before real businesses arrive - an invented bakery sitting in the
 * public directory is exactly the sort of thing that quietly becomes permanent.
 *
 * NO EMAIL IS SENT by this script. It writes the rows directly rather than
 * going through the review actions, because those need a browser session - and
 * because nobody needs three test emails about a bakery that does not exist.
 */

import postgres from 'postgres'

const sql = postgres(process.env.DIRECT_URL, { max: 1, prepare: false })
const mode = process.argv[2] ?? 'create'
const SLUG_PREFIX = 'pilot-walkthrough'

const [owner] = await sql`
  SELECT pr.user_id AS id, u.email, u.full_name
  FROM platform_roles pr JOIN users u ON u.id = pr.user_id
  WHERE pr.role = 'PLATFORM_OWNER' AND pr.status = 'ACTIVE' LIMIT 1
`

if (!owner) {
  console.error('No Platform Owner. Run npm run platform:whoami.')
  process.exit(1)
}

console.log(`Platform Owner: ${owner.full_name ?? '?'} <${owner.email}>\n`)

/* ------------------------------------------------------------- remove */

if (mode === 'remove') {
  const businesses = await sql`
    SELECT id, public_id, name FROM businesses WHERE slug LIKE ${SLUG_PREFIX + '%'}
  `
  const apps = await sql`
    SELECT id FROM business_applications
    WHERE business_name LIKE 'Pilot Walkthrough%'
  `

  await sql.begin(async (tx) => {
    const bizIds = businesses.map((b) => b.id)
    const appIds = apps.map((a) => a.id)

    if (appIds.length) {
      await tx`UPDATE business_applications SET business_id = NULL WHERE id = ANY(${appIds})`
    }
    if (bizIds.length) {
      await tx`UPDATE businesses SET application_id = NULL WHERE id = ANY(${bizIds})`
      await tx`DELETE FROM business_memberships WHERE business_id = ANY(${bizIds})`
      // Products and categories belong to the store the approval created.
      await tx`DELETE FROM products WHERE store_id IN (
                 SELECT store_id FROM businesses WHERE id = ANY(${bizIds}) AND store_id IS NOT NULL)`
      await tx`DELETE FROM categories WHERE store_id IN (
                 SELECT store_id FROM businesses WHERE id = ANY(${bizIds}) AND store_id IS NOT NULL)`
    }
    if (appIds.length) {
      await tx`DELETE FROM business_application_documents WHERE application_id = ANY(${appIds})`
      await tx`DELETE FROM business_applications WHERE id = ANY(${appIds})`
    }
    if (bizIds.length) {
      const stores = await tx`SELECT store_id FROM businesses WHERE id = ANY(${bizIds}) AND store_id IS NOT NULL`
      await tx`DELETE FROM businesses WHERE id = ANY(${bizIds})`
      const storeIds = stores.map((s) => s.store_id)
      if (storeIds.length) {
        await tx`DELETE FROM stores WHERE id = ANY(${storeIds}) AND is_first_party = false`
      }
    }
  })

  for (const b of businesses) console.log(`removed business ${b.public_id} ${b.name}`)
  console.log(`removed ${apps.length} application(s)`)
  console.log('\nGone. The directory is back to real businesses only.')
  await sql.end()
  process.exit(0)
}

/* ------------------------------------------------------------- create */

const [existing] = await sql`
  SELECT id, status, business_name FROM business_applications
  WHERE business_name LIKE 'Pilot Walkthrough%' LIMIT 1
`

if (mode === 'create') {
  if (existing) {
    console.log(`An application already exists: ${existing.business_name} [${existing.status}]`)
    console.log('Run with "approve" to approve it, or "remove" to clear it.')
    await sql.end()
    process.exit(0)
  }

  const [app] = await sql`
    INSERT INTO business_applications
      (applicant_id, provider_type, business_name, kind, city, summary,
       contact_phone, whatsapp, contact_email, legal_name, id_type, id_number,
       residential_address, address_evidence_type, operating_area,
       status, submitted_at, draft_started_at)
    VALUES
      (${owner.id}, 'INFORMAL_BUSINESS', 'Pilot Walkthrough Bakery', 'FOOD', 'Mutare',
       'Bread, buns and cakes, baked fresh every morning.',
       '+263771234567', '+263771234567', ${owner.email},
       ${owner.full_name ?? 'Pilot Owner'}, 'NATIONAL_ID', '63-000000X00',
       '14 Example Street, Sakubva', 'LEASE', 'Sakubva and town',
       'SUBMITTED', now(), now())
    RETURNING id
  `

  // Document ROWS only - no files are put in the private bucket. The reviewer
  // screen shows what was supplied; nobody needs a fake ID photo in storage.
  for (const kind of ['ID_DOCUMENT', 'ID_SELFIE', 'PROOF_OF_ADDRESS']) {
    await sql`
      INSERT INTO business_application_documents
        (application_id, uploaded_by, kind, path, mime_type, size_bytes)
      VALUES (${app.id}, ${owner.id}, ${kind},
              ${app.id + '/' + kind + '-walkthrough.jpg'}, 'image/jpeg', 102400)
    `
  }

  await sql`
    INSERT INTO business_application_events (application_id, actor_id, event, to_status, message)
    VALUES (${app.id}, ${owner.id}, 'SUBMITTED', 'SUBMITTED', 'Created by the walkthrough script.')
  `

  console.log('Created an application, ready to review.\n')
  console.log('  1. Open  /super-admin/applications')
  console.log('  2. Click "Pilot Walkthrough Bakery"')
  console.log('  3. Claim it, try "ask for more information", read the history')
  console.log('  4. Then run:  npm run pilot:walk -- approve')
  await sql.end()
  process.exit(0)
}

/* ------------------------------------------------------------ approve */

if (mode === 'approve') {
  if (!existing) {
    console.error('Nothing to approve. Run npm run pilot:walk first.')
    process.exit(1)
  }
  if (existing.status === 'APPROVED') {
    console.log('Already approved.')
    await sql.end()
    process.exit(0)
  }

  const slug = `${SLUG_PREFIX}-bakery`

  await sql.begin(async (tx) => {
    // Its own store, exactly as a real approval creates.
    const [store] = await tx`
      INSERT INTO stores (name, slug, is_first_party, city)
      VALUES ('Pilot Walkthrough Bakery', ${slug}, false, 'Mutare')
      ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
    `

    const [biz] = await tx`
      INSERT INTO businesses
        (name, slug, store_id, summary, kind, provider_type, status, city,
         contact_phone, contact_email, application_id, created_by,
         reviewed_by, reviewed_at, identity_verified_at, address_verified_at)
      VALUES ('Pilot Walkthrough Bakery', ${slug}, ${store.id},
              'Bread, buns and cakes, baked fresh every morning.', 'FOOD',
              'INFORMAL_BUSINESS', 'PILOT', 'Mutare',
              '+263771234567', ${owner.email}, ${existing.id}, ${owner.id},
              ${owner.id}, now(), now(), now())
      RETURNING id, public_id
    `

    await tx`
      INSERT INTO business_memberships (business_id, user_id, role, granted_by)
      VALUES (${biz.id}, ${owner.id}, 'BUSINESS_OWNER', ${owner.id})
      ON CONFLICT DO NOTHING
    `

    await tx`
      INSERT INTO categories (store_id, name, slug, description, sort_order)
      VALUES (${store.id}, 'General', 'general', 'Everything this business sells.', 0)
      ON CONFLICT DO NOTHING
    `

    await tx`
      UPDATE business_applications
      SET status = 'APPROVED', business_id = ${biz.id},
          reviewed_by = ${owner.id}, reviewed_at = now()
      WHERE id = ${existing.id}
    `

    await tx`
      INSERT INTO business_application_events (application_id, actor_id, event, to_status, message)
      VALUES (${existing.id}, ${owner.id}, 'APPROVED', 'APPROVED', 'Approved by the walkthrough script.')
    `

    console.log(`Approved. ${biz.public_id} is live.\n`)
  })

  console.log('  1. Open  /account   - a card for the business is now there')
  console.log('  2. Click it         - that is the merchant workspace')
  console.log('  3. Add a product, then toggle "Publish to Musuwo"')
  console.log('  4. Open /marketplace - it is in the directory')
  console.log('\nWhen you have finished looking:  npm run pilot:walk -- remove')
  await sql.end()
  process.exit(0)
}

console.error(`Unknown mode "${mode}". Use create, approve or remove.`)
process.exit(1)
