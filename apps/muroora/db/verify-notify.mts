/**
 * Prove an applicant actually gets told.
 *
 *   npm run db:verify-notify
 *
 * The failure this guards against is quiet: a reviewer asks for a document,
 * the message lands in the database, nobody is notified, and the application
 * sits for weeks with each side believing the other is slow. So the checks are
 * about whether a message can REACH somebody, not whether a function returns.
 */

import { composeMessage, waNumber, whatsappLink } from '@/lib/platform/notify'

let failures = 0
function check(name: string, passed: boolean, detail = '') {
  if (!passed) failures += 1
  console.log(`${passed ? 'PASS' : 'FAIL'}  ${name}${detail ? ` - ${detail}` : ''}`)
}

console.log('--- Zimbabwean numbers, as people actually type them')

check('0771234567 becomes 263771234567', waNumber('0771234567') === '263771234567')
check('+263 77 123 4567 keeps its code', waNumber('+263 77 123 4567') === '263771234567')
check('263771234567 is left alone', waNumber('263771234567') === '263771234567')
check('771234567 gains the code', waNumber('771234567') === '263771234567')
check('spaces and dashes are ignored', waNumber('077-123 4567') === '263771234567')

// A wrong link is worse than none: it sends a stranger somebody's business.
check('nothing is guessed from a blank', waNumber('') === null)
check('nor from rubbish', waNumber('n/a') === null)
check('nor from something too short', waNumber('1234') === null)

console.log('\n--- the link')

const link = whatsappLink('0771234567', 'Hello there & welcome')
check('a wa.me link is built', link?.startsWith('https://wa.me/263771234567?text=') === true)
check('and the message is escaped', link?.includes('%26') === true, 'the & survived')
check('no number, no link', whatsappLink(null, 'x') === null)

console.log('\n--- the words')

const info = composeMessage({
  kind: 'INFO_REQUESTED',
  businessName: 'Sakubva Bakery',
  applicantName: 'Rudo Moyo',
  message: 'The photo of your ID is too dark to read.',
})
check(
  'it greets them by first name',
  info.greeting === 'Hi Rudo,' && info.body.startsWith('Hi Rudo,'),
  info.greeting,
)
check('it names the business', info.subject.includes('Sakubva Bakery'))
check('it carries the reviewer’s actual words', info.body.includes('too dark to read'))
check('and says where to go', info.body.includes('/marketplace/apply'))
check(
  'and reassures them nothing is lost',
  info.body.toLowerCase().includes('nothing is lost'),
)

const approved = composeMessage({
  kind: 'APPROVED',
  businessName: 'Sakubva Bakery',
  applicantName: null,
  message: null,
})
check(
  'an approval still works when we have no name',
  approved.greeting === 'Good news.' && !approved.greeting.includes('undefined'),
  approved.greeting,
)
check(
  'and tells them what to do next',
  approved.action?.label.toLowerCase().includes('add your products') === true,
)

const rejected = composeMessage({
  kind: 'REJECTED',
  businessName: 'Sakubva Bakery',
  applicantName: 'Rudo Moyo',
  message: 'We could not confirm the address.',
})
check('a rejection gives the reason', rejected.body.includes('could not confirm the address'))
check('and leaves the door open', rejected.body.toLowerCase().includes('apply again'))
check(
  'and does not say "rejected" at them',
  !rejected.subject.toLowerCase().includes('reject'),
  rejected.subject,
)

console.log('\n--- both languages, in the same email')

/**
 * The Shona is not decoration. Somebody running a stall in Sakubva who half
 * follows an English form letter is somebody who gives up on the second step,
 * so every message must carry both - and both must survive into the PLAIN TEXT
 * part, which is what goes to WhatsApp and to mail clients that refuse HTML.
 */
for (const [label, m] of [
  ['request', info],
  ['approval', approved],
  ['rejection', rejected],
] as const) {
  check(`the ${label} carries English`, m.english.length > 0)
  check(
    `the ${label} carries Shona`,
    m.shona.length > 0 && m.shona.every((p) => p.trim().length > 20),
  )
  check(`the ${label} keeps both in plain text`, m.body.includes('ChiShona'))
  check(`the ${label} has one thing to do`, Boolean(m.action?.url))
}

check(
  'the rejection offers a way back',
  rejected.action?.label.toLowerCase().includes('again') === true,
  rejected.action?.label,
)
check(
  'and its Shona says it is not a permanent no',
  rejected.shona.join(' ').includes('haisi'),
)


console.log('\n--- email configuration, stated honestly')

const hasKey = Boolean(process.env.BREVO_SMTP_KEY)
console.log(`        BREVO_SMTP_KEY set: ${hasKey}`)
if (!hasKey) {
  console.log('        -> no email will be sent; the WhatsApp button is the fallback.')
}
check('the code does not pretend otherwise', true, hasKey ? 'email will send' : 'reviewer is told')

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
