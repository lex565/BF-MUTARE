/**
 * Send one real email, to prove the configuration works.
 *
 *   npm run mail:test -- you@example.com
 *   npm run mail:test -- you@example.com APPROVED
 *
 * Deliberately sends a REAL message rather than checking that a function
 * returns. The failures that matter here - a wrong SMTP login, an unverified
 * sender, a key from the wrong tab - all look fine right up until nothing
 * arrives, so the only honest test is one that lands in an inbox.
 *
 * Prints exactly what Brevo said when it refuses, because "could not send" is
 * useless and "sender not verified" tells you what to go and fix.
 */

import nodemailer from 'nodemailer'

const to = process.argv[2]
const kind = (process.argv[3] ?? 'INFO_REQUESTED').toUpperCase()

if (!to) {
  console.error('Who to? npm run mail:test -- you@example.com [INFO_REQUESTED|APPROVED|REJECTED]')
  process.exit(1)
}

const key = process.env.BREVO_SMTP_KEY
const login = process.env.BREVO_SMTP_LOGIN
const sender = process.env.BREVO_SENDER_EMAIL

console.log(`SMTP key    ${key ? key.slice(0, 12) + '…' : 'NOT SET'}`)
console.log(`SMTP login  ${login ?? 'NOT SET'}`)
console.log(`Sender      ${sender ?? 'NOT SET'}`)
console.log(`Sending a ${kind} email to ${to}\n`)

if (!key || !login) {
  console.error('BREVO_SMTP_KEY and BREVO_SMTP_LOGIN must both be set.')
  process.exit(1)
}
if (key.startsWith('xkeysib-')) {
  console.error(
    'That is an API key, not an SMTP key. SMTP keys start xsmtpsib- and are on the SMTP tab.',
  )
  process.exit(1)
}

// Imported through the app alias so the test renders EXACTLY what the
// application would send, rather than a copy that can drift from it.
const { renderEmail } = await import('../lib/platform/notify.ts')

const mail = renderEmail({
  kind,
  businessName: 'Sakubva Bakery',
  applicantName: 'Rudo Moyo',
  message:
    kind === 'REJECTED'
      ? 'The address on the lease is not the address you gave us, and we could not reconcile the two.'
      : kind === 'APPROVED'
        ? null
        : 'The photo of your ID is too dark to read the number. A picture in daylight, with all four corners showing, is all we need.',
})

const transport = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: { user: login, pass: key },
})

try {
  console.log('Verifying the connection…')
  await transport.verify()
  console.log('  connection and credentials accepted\n')

  const info = await transport.sendMail({
    from: { name: 'Musuwo', address: sender ?? login },
    to,
    subject: mail.subject,
    text: mail.text,
    html: mail.html,
  })

  console.log('SENT')
  console.log(`  subject   ${mail.subject}`)
  console.log(`  messageId ${info.messageId}`)
  console.log(`  accepted  ${info.accepted?.join(', ')}`)
  if (info.rejected?.length) console.log(`  REJECTED  ${info.rejected.join(', ')}`)
  console.log('\nCheck the inbox, and the spam folder.')
} catch (error) {
  console.error('FAILED')
  console.error(`  ${error.message}`)
  if (/535|authentication/i.test(error.message)) {
    console.error(
      '\n  535 means the login or key is wrong. The SMTP login is shown beside the key\n' +
        '  in Brevo under SMTP & API -> SMTP. It is often a number like 8a1b2c@smtp-brevo.com\n' +
        '  rather than your account email.',
    )
  }
  if (/sender/i.test(error.message)) {
    console.error(
      '\n  Brevo refuses mail from an address it has not verified. Add it under\n' +
        '  Senders, Domains & Dedicated IPs -> Senders.',
    )
  }
  process.exitCode = 1
}
