/**
 * Create the private buckets the application needs, and prove they are private.
 *
 *   npm run storage:setup
 *
 * WHY THIS EXISTS. `business-verification` was created lazily, on the first
 * upload. That first upload never happened - Next was rejecting the request at
 * its 1 MB server-action limit before the code ran - so the bucket did not
 * exist, and the uploads that DID get through came back 404 "Bucket not found".
 * Two bugs propping each other up.
 *
 * Creating storage on demand is the wrong shape anyway: it makes the first
 * person to use a feature the one who discovers it is broken. This runs
 * deliberately, says what it did, and checks the result.
 *
 * IDEMPOTENT. Safe to run against a database that already has them.
 */

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

/**
 * Every bucket, and whether it may be public.
 *
 * `public: false` on business-verification is the whole security posture of
 * the identity documents. A national ID, and a photo of somebody holding it,
 * must never be reachable by URL.
 */
const BUCKETS = [
  {
    name: 'business-verification',
    public: false,
    fileSizeLimit: 8 * 1024 * 1024,
    what: 'ID documents, holding-ID photos, address evidence, certificates',
  },
]

let failures = 0

const { data: existing, error: listErr } = await admin.storage.listBuckets()
if (listErr) {
  console.error('Could not list buckets:', listErr.message)
  process.exit(1)
}

for (const spec of BUCKETS) {
  const found = existing.find((b) => b.name === spec.name)

  if (!found) {
    const { error } = await admin.storage.createBucket(spec.name, {
      public: spec.public,
      fileSizeLimit: spec.fileSizeLimit,
    })
    if (error && !/already exists/i.test(error.message)) {
      console.error(`FAIL  create ${spec.name}: ${error.message}`)
      failures += 1
      continue
    }
    console.log(`created  ${spec.name}  (${spec.what})`)
  } else {
    console.log(`exists   ${spec.name}  (${spec.what})`)

    // A bucket that has drifted to public is an incident, not a warning.
    if (found.public !== spec.public) {
      const { error } = await admin.storage.updateBucket(spec.name, {
        public: spec.public,
      })
      console.log(
        error
          ? `FAIL     could not set ${spec.name} back to private: ${error.message}`
          : `FIXED    ${spec.name} was PUBLIC and has been made private`,
      )
      if (error) failures += 1
    }
  }

  /* -------------------------------------------------- prove it is private */

  if (!spec.public && anonKey) {
    const path = `_selfcheck/${Date.now()}.txt`
    const { error: upErr } = await admin.storage
      .from(spec.name)
      .upload(path, new TextEncoder().encode('check'), { contentType: 'text/plain' })

    if (upErr) {
      console.log(`FAIL     ${spec.name} rejected a test upload: ${upErr.message}`)
      failures += 1
      continue
    }

    const anon = createClient(url, anonKey, { auth: { persistSession: false } })
    const { error: anonErr } = await anon.storage.from(spec.name).download(path)

    if (anonErr) {
      console.log(`ok       ${spec.name} refuses the public key`)
    } else {
      console.log(`FAIL     ${spec.name} IS READABLE WITH THE PUBLIC KEY. Identity documents are exposed.`)
      failures += 1
    }

    await admin.storage.from(spec.name).remove([path])
  }
}

console.log(failures === 0 ? '\nStorage is ready.' : `\n${failures} problem(s).`)
process.exit(failures === 0 ? 0 : 1)
