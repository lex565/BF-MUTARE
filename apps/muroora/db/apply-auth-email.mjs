/**
 * Push the recovery email template - and the name it is sent under - into
 * Supabase.
 *
 *   npm run auth:email
 *
 * WHY A SCRIPT AND NOT THE DASHBOARD. The template lives in
 * docs/email/reset-password.html so it can be reviewed, diffed and reverted
 * like anything else. Pasting HTML into a web form by hand is how the live
 * email and the file in the repository drift apart, and the first anybody
 * hears of it is a customer forwarding a message that says something nobody
 * wrote this year.
 *
 * COMMENTS ARE STRIPPED BEFORE UPLOAD. Supabase renders the Go template over
 * the whole body, comments included. The file's own header names the old
 * token variables while explaining why they were abandoned; left in, Go would
 * substitute a real single-use recovery token into the customer's email,
 * inside an HTML comment, where a scanner would find it and burn it. This is
 * not hypothetical tidiness - it is the exact failure the template was
 * rewritten to escape.
 *
 * WHAT IT NEEDS
 *
 *   SUPABASE_ACCESS_TOKEN   a personal access token from
 *                           https://supabase.com/dashboard/account/tokens
 *                           This is NOT the service-role key and NOT the anon
 *                           key. It is account-wide and can change any project
 *                           on the account, so keep it out of .env.local and
 *                           pass it on the command line for one run:
 *
 *                             SUPABASE_ACCESS_TOKEN=sbp_... npm run auth:email
 *
 *   NEXT_PUBLIC_SUPABASE_URL  read from .env.local, only to work out the
 *                             project ref.
 *
 * Pass --dry to render exactly what would be sent without sending it.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const TEMPLATE = join(here, '..', 'docs', 'email', 'reset-password.html')

/** The name the email arrives under, and the subject line. */
const SENDER_NAME = 'Musuwo'
const SUBJECT = 'Your Musuwo password code'

const dry = process.argv.includes('--dry')

/**
 * Remove HTML comments.
 *
 * Deliberately blunt and non-greedy. The template contains no conditional
 * comments and no `--` inside a comment body, so there is nothing here for a
 * cleverer parser to earn.
 */
function stripComments(html) {
  return html.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\n/gm, '').trim()
}

function projectRef(url) {
  // https://abcdefghijklm.supabase.co -> abcdefghijklm
  const host = new URL(url).hostname
  const ref = host.split('.')[0]
  if (!ref || ref === 'supabase') {
    throw new Error(`Could not read a project ref out of ${url}`)
  }
  return ref
}

async function main() {
  const token = process.env.SUPABASE_ACCESS_TOKEN
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not set. Run through npm so .env.local is loaded.',
    )
  }

  const body = stripComments(await readFile(TEMPLATE, 'utf8'))

  if (body.includes('<!--')) {
    throw new Error('A comment survived stripping. Refusing to upload.')
  }
  if (!body.includes('{{ .Token }}')) {
    throw new Error(
      'The template has no {{ .Token }} in it, so the email would carry no code. Refusing to upload.',
    )
  }

  console.log(`Template   ${TEMPLATE}`)
  console.log(`Stripped   ${body.length} bytes, ${body.split('\n').length} lines`)
  console.log(`Sender     ${SENDER_NAME}`)
  console.log(`Subject    ${SUBJECT}`)

  if (dry) {
    console.log('\n--dry: nothing sent. The body that would go up:\n')
    console.log(body)
    return
  }

  if (!token) {
    throw new Error(
      'SUPABASE_ACCESS_TOKEN is not set.\n' +
        'Create one at https://supabase.com/dashboard/account/tokens and run:\n' +
        '  SUPABASE_ACCESS_TOKEN=sbp_... npm run auth:email\n' +
        'Or run with --dry to see the output without sending it.',
    )
  }

  const ref = projectRef(supabaseUrl)
  const response = await fetch(
    `https://api.supabase.com/v1/projects/${ref}/config/auth`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mailer_subjects_recovery: SUBJECT,
        mailer_templates_recovery_content: body,
        // The name on the envelope. This is the setting that made the email
        // arrive from "Muroora Mart" no matter which website asked for it.
        smtp_sender_name: SENDER_NAME,
        // Eight digits. The reset form validates exactly eight, so the two
        // must move together or every genuine code is rejected.
        mailer_otp_length: 8,
      }),
    },
  )

  if (!response.ok) {
    throw new Error(
      `Supabase refused the update: ${response.status} ${await response.text()}`,
    )
  }

  console.log(`\nApplied to project ${ref}.`)
  console.log(
    'Check it: Authentication > Emails > Reset Password, and send yourself one.',
  )
}

main().catch((error) => {
  console.error('\n' + error.message)
  process.exitCode = 1
})
