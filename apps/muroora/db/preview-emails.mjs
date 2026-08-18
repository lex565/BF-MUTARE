/**
 * Write the three emails to HTML files so they can be looked at without
 * sending anything. Renders through the SAME function the application uses,
 * so what you see is what would arrive.
 *
 *   npm run mail:preview
 */
import { writeFile, mkdir } from 'node:fs/promises'
import { renderEmail } from '../lib/platform/notify.ts'

const out = 'C:/Users/DELL/AppData/Local/Temp/claude/C--Users-DELL/2c05ee24-02cd-4ecc-923d-78f2cd4243d1/scratchpad/emails'
await mkdir(out, { recursive: true })

const cases = [
  {
    kind: 'INFO_REQUESTED',
    message:
      'The photo of your ID is too dark to read the number. A picture in daylight, with all four corners showing, is all we need.',
  },
  { kind: 'APPROVED', message: null },
  {
    kind: 'REJECTED',
    message:
      'The address on the lease is not the address you gave us, and we could not reconcile the two.',
  },
]

for (const c of cases) {
  const mail = renderEmail({
    kind: c.kind,
    businessName: 'Sakubva Bakery',
    applicantName: 'Rudo Moyo',
    message: c.message,
  })
  const file = `${out}/${c.kind}.html`
  await writeFile(file, mail.html, 'utf8')
  console.log(`${c.kind.padEnd(16)} ${mail.subject}`)
  console.log(`                 ${file}`)
}
