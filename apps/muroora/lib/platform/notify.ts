import nodemailer from 'nodemailer'

import { brand, siteOrigin } from '@/lib/brand'

/**
 * Telling an applicant what happened, in a way a person would actually read.
 *
 * THE PROBLEM THIS SOLVES. Asking a business for more information wrote the
 * message into the database and nothing else. The applicant only saw it if they
 * happened to return to the site - so an application could sit in
 * NEEDS_INFORMATION for weeks with each side believing the other was slow. For
 * a pilot that is the likeliest way an onboarding quietly dies.
 *
 * EVERY EMAIL IS IN BOTH LANGUAGES. English first, then the same thing in
 * Shona, in the same email rather than as a choice somebody has to make. The
 * people this is for are running a stall in Sakubva or letting rooms in
 * Dangamvura; a form letter in English that they half-follow is how a business
 * gives up on the second step. The Shona is not a translation of officialese -
 * it is written the way somebody would actually say it.
 *
 * THE TONE IS DELIBERATE, especially on a rejection. "Your application has
 * been declined" ends the conversation. Almost every rejection at this stage is
 * a fixable document, so the email says what was wrong, says plainly that it is
 * not a permanent no, and invites them back.
 *
 * TWO CHANNELS
 *
 *   EMAIL is automatic, over Brevo SMTP. Never throws - a notification that
 *   fails must not undo the approval it was announcing.
 *
 *   WHATSAPP is a link the REVIEWER clicks, which opens their own WhatsApp
 *   with the message already written. Not automated on purpose: automated
 *   WhatsApp needs the Meta Business API, which costs money, takes weeks to
 *   approve and wants a verified number Musuwo does not have. wa.me works
 *   today, costs nothing, and is what people here actually read.
 *
 * SMS IS DELIBERATELY ABSENT - see the note at the bottom of this file.
 */

export interface NotifyResult {
  emailed: boolean
  /** A link the reviewer can click to send the same words on WhatsApp. */
  whatsappUrl: string | null
  /** Why the email did not go, when it did not. Shown to the reviewer. */
  emailProblem: string | null
}

/**
 * Turn a phone number into the digits WhatsApp expects.
 *
 * Zimbabwean numbers arrive as 0771234567, +263771234567, 263 77 123 4567 and
 * every spacing in between. Returns null rather than guessing when it cannot
 * tell - a wa.me link to the wrong person sends a stranger somebody's business.
 */
export function waNumber(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null

  if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 10) {
    return `263${digits.slice(1)}`
  }
  if (digits.length >= 11 && digits.length <= 15) return digits
  if (digits.length === 9) return `263${digits}`
  return null
}

export function whatsappLink(
  phone: string | null | undefined,
  message: string,
): string | null {
  const number = waNumber(phone)
  if (!number) return null
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

/* ------------------------------------------------------------- the words */

interface Applicant {
  name: string | null
  email: string | null
  phone: string | null
}

export type NoticeKind = 'INFO_REQUESTED' | 'APPROVED' | 'REJECTED'

interface Composed {
  subject: string
  /** English, then Shona. What goes on WhatsApp and in the plain-text part. */
  body: string
  greeting: string
  english: string[]
  shona: string[]
  /** The reviewer's own words, quoted apart from ours. */
  quoted: string | null
  action: { label: string; url: string } | null
  signOff: string
}

/**
 * The words, written once, so email and WhatsApp cannot say different things.
 *
 * First names only in the greeting. "Dear Applicant" is how an institution
 * writes; these are people who will be answering the phone themselves.
 */
export function composeMessage(params: {
  kind: NoticeKind
  businessName: string
  applicantName: string | null
  message?: string | null
}): Composed {
  const first = params.applicantName?.trim().split(/\s+/)[0]
  const name = params.businessName
  const applyUrl = `${siteOrigin()}/marketplace/apply`
  const homeUrl = siteOrigin()

  switch (params.kind) {
    case 'INFO_REQUESTED': {
      const greeting = first ? `Hi ${first},` : 'Hello,'
      const english = [
        `Thank you for putting ${name} forward. We have read through it and you are nearly there - there is just one thing we need before we can finish.`,
        `Everything you have already filled in is saved, so this should only take a few minutes. Nothing is lost.`,
      ]
      const shona = [
        `Tinotenda nekunyoresa ${name} pa Musuwo. Taverenga zvese zvamakanyora, uye zvasara zvishoma chete - pane chinhu chimwe chatinoda tisati tapedza.`,
        `Zvese zvamakanyora zvakachengetedzwa, saka hazvitore nguva refu. Hapana chamarasika.`,
      ]
      return {
        subject: `${name}: one more thing / pane chimwe chinhu`,
        greeting,
        english,
        shona,
        quoted: params.message?.trim() || null,
        action: { label: 'Finish your application', url: applyUrl },
        signOff: 'If anything is unclear, reply to this email and a person will answer you.',
        body: [
          greeting,
          english[0],
          params.message ? `WHAT WE NEED:\n${params.message}` : '',
          english[1],
          `Finish it here: ${applyUrl}`,
          '',
          '--- ChiShona ---',
          shona[0],
          shona[1],
          `Pedzisai pano: ${applyUrl}`,
          '',
          `- ${brand.name}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      }
    }

    case 'APPROVED': {
      const greeting = first ? `${first}, good news.` : 'Good news.'
      const english = [
        `${name} has been approved. It is on Musuwo now, and customers can find it.`,
        `The next thing to do is add your products and your prices. Until you do, people can see your business but not what you sell.`,
        `Thank you for being one of the first. We would rather hear from you than not - if something does not work, tell us.`,
      ]
      const shona = [
        `${name} yagamuchirwa. Yava pa Musuwo, uye vatengi vanogona kukuwanai.`,
        `Chinotevera ndechekuisa zvigadzirwa zvenyu nemitengo. Musati mazviita, vanhu vanoona bhizimusi renyu asi vasingaoni zvamunotengesa.`,
        `Tinotenda nekuva vekutanga. Kana paine chisingashande, tiudzei - hatidi kunyarara.`,
      ]
      return {
        subject: `${name} is live on Musuwo / yava pa Musuwo`,
        greeting,
        english,
        shona,
        quoted: params.message?.trim() || null,
        action: { label: 'Add your products', url: homeUrl },
        signOff: 'Welcome to Musuwo. Tinokugamuchirai.',
        body: [
          greeting,
          english[0],
          params.message ? params.message : '',
          english[1],
          `Sign in here: ${homeUrl}`,
          '',
          '--- ChiShona ---',
          shona[0],
          shona[1],
          `Pindai pano: ${homeUrl}`,
          '',
          `- ${brand.name}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      }
    }

    case 'REJECTED': {
      const greeting = first ? `Hi ${first},` : 'Hello,'
      /**
       * A rejection at this stage is nearly always a fixable document, so this
       * says so out loud. "Declined" with no route back is how somebody who
       * would have been a good merchant never tries again.
       */
      const english = [
        `We have read your application for ${name}, and we are not able to list it as it stands. We wanted to tell you why rather than leave you guessing.`,
        `This is not a permanent no. If this is something you can put right, please apply again - we will look at it properly, and we would be glad to.`,
      ]
      const shona = [
        `Taverenga chikumbiro chenyu che ${name}, uye hatisi kukwanisa kuchiisa pa Musuwo sezvachiri. Tada kukuudzai chikonzero pane kukusiyai musingazivi.`,
        `Iyi haisi "kwete" zvachose. Kana muchikwanisa kugadzirisa izvi, tumirai zvakare - tichaongorora zvakare, uye tichafara kuzviita.`,
      ]
      return {
        subject: `About your ${name} application / nezve chikumbiro chenyu`,
        greeting,
        english,
        shona,
        quoted: params.message?.trim() || null,
        action: { label: 'Apply again', url: applyUrl },
        signOff: 'If you think we have this wrong, reply to this email and a person will read it.',
        body: [
          greeting,
          english[0],
          params.message ? `WHY:\n${params.message}` : '',
          english[1],
          `Apply again here: ${applyUrl}`,
          '',
          '--- ChiShona ---',
          shona[0],
          shona[1],
          `Tumirai zvakare pano: ${applyUrl}`,
          '',
          `- ${brand.name}`,
        ]
          .filter(Boolean)
          .join('\n\n'),
      }
    }
  }
}

/* ---------------------------------------------------------------- layout */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const para = (text: string, colour = '#3f3a30') =>
  `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.65;color:${colour};">${escapeHtml(
    text,
  ).replace(/\n/g, '<br />')}</p>`

/**
 * Tables and inline styles, because that is what email clients understand.
 * Outlook renders with Word. No external CSS, no flexbox.
 *
 * The logo is an absolute URL: an email client can only load something already
 * on the internet.
 */
function asHtml(c: Composed, accent: string): string {
  const logo = `${siteOrigin()}/icons/musuwo-icon.png`

  const quoted = c.quoted
    ? `<tr><td style="padding:4px 28px 0 28px;">
         <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
           <tr><td style="background:#f4f1ea;border-left:4px solid ${accent};padding:16px 18px;">
             ${para(c.quoted, '#12271b')}
           </td></tr>
         </table>
       </td></tr>`
    : ''

  const button = c.action
    ? `<tr><td align="center" style="padding:26px 28px 0 28px;">
         <table role="presentation" cellpadding="0" cellspacing="0" border="0">
           <tr><td align="center" bgcolor="#005029" style="background:#005029;padding:14px 32px;">
             <a href="${c.action.url}" style="display:inline-block;font-family:'Courier New',monospace;font-size:13px;font-weight:bold;letter-spacing:1.5px;text-transform:uppercase;color:#ffffff;text-decoration:none;">${escapeHtml(
               c.action.label,
             )}</a>
           </td></tr>
         </table>
       </td></tr>`
    : ''

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f1ea;margin:0;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:540px;background:#ffffff;border:1px solid #e3ded2;">

  <tr><td align="center" style="padding:30px 28px 6px 28px;">
    <img src="${logo}" alt="${escapeHtml(brand.name)}" width="60" style="display:block;width:60px;height:auto;border:0;" />
    <p style="margin:10px 0 0 0;font-size:21px;font-weight:bold;letter-spacing:-0.02em;color:#12271b;">${escapeHtml(
      brand.name,
    )}</p>
  </td></tr>

  <tr><td style="padding:22px 28px 0 28px;">
    <p style="margin:0 0 18px 0;font-size:20px;line-height:1.3;font-weight:bold;color:${accent};">${escapeHtml(
      c.greeting,
    )}</p>
    ${c.english.slice(0, 1).map((p) => para(p)).join('')}
  </td></tr>

  ${quoted}

  <tr><td style="padding:16px 28px 0 28px;">
    ${c.english.slice(1).map((p) => para(p)).join('')}
  </td></tr>

  ${button}

  <!-- The same thing in Shona. Divided quietly rather than shouted, so it
       reads as one letter to one person and not as a bilingual notice. -->
  <tr><td style="padding:28px 28px 0 28px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="border-top:1px solid #e3ded2;padding-top:20px;">
        <p style="margin:0 0 14px 0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#8a8272;">ChiShona</p>
        ${c.shona.map((p) => para(p, '#4b463c')).join('')}
      </td></tr>
    </table>
  </td></tr>

  <tr><td style="padding:8px 28px 30px 28px;">
    <p style="margin:0;padding-top:18px;border-top:1px solid #e3ded2;font-size:14px;line-height:1.6;color:#6b6455;">${escapeHtml(
      c.signOff,
    )}</p>
  </td></tr>

  <tr><td align="center" bgcolor="#f4f1ea" style="background:#f4f1ea;padding:16px 28px;">
    <p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#8a8272;">${escapeHtml(
      brand.name,
    )} &middot; Mutare &middot; Zimbabwe</p>
  </td></tr>

</table></td></tr></table>`
}

/** Green for good news, a warmer tone for everything else. */
function accentFor(kind: NoticeKind): string {
  return kind === 'APPROVED' ? '#005029' : '#b4551b'
}

/* ---------------------------------------------------------------- sending */

/**
 * Brevo, over SMTP.
 *
 * SMTP RATHER THAN THE REST API because the key Musuwo holds is an SMTP key -
 * they start `xsmtpsib-`, while the REST API wants an `xkeysib-` key from a
 * different tab of the same page. Using the wrong one fails with a bare 401
 * and no clue why, so the key type is checked below and says so in words.
 *
 * Brevo rather than a new provider because it is already sending the password
 * reset: one account, one sender identity, one free allowance of 300 a day,
 * which is far beyond a pilot. NO NEW PAID SERVICE.
 */
function transport() {
  const key = process.env.BREVO_SMTP_KEY ?? process.env.BREVO_API_KEY
  const login = process.env.BREVO_SMTP_LOGIN
  if (!key || !login) return null

  return nodemailer.createTransport({
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false, // STARTTLS on 587, which is what Brevo wants.
    auth: { user: login, pass: key },
  })
}

async function sendEmail(params: {
  to: string
  toName: string | null
  subject: string
  text: string
  html: string
}): Promise<{ ok: boolean; problem: string | null }> {
  const key = process.env.BREVO_SMTP_KEY ?? process.env.BREVO_API_KEY

  if (!key) {
    return {
      ok: false,
      problem:
        'No email sent - BREVO_SMTP_KEY is not set on this deployment. Use the WhatsApp button.',
    }
  }
  if (key.startsWith('xkeysib-')) {
    return {
      ok: false,
      problem:
        'That is a Brevo API key, not an SMTP key. SMTP keys start xsmtpsib- and are on the SMTP tab of SMTP & API.',
    }
  }
  if (!process.env.BREVO_SMTP_LOGIN) {
    return {
      ok: false,
      problem:
        'BREVO_SMTP_LOGIN is not set - it is the login shown beside the SMTP key in Brevo, usually the account email.',
    }
  }

  const mailer = transport()
  if (!mailer) return { ok: false, problem: 'Mail is not configured.' }

  const from = process.env.BREVO_SENDER_EMAIL ?? 'no-reply@musuwo.online'

  try {
    await mailer.sendMail({
      from: { name: brand.name, address: from },
      to: params.toName ? `"${params.toName}" <${params.to}>` : params.to,
      subject: params.subject,
      // Plain text as well as HTML: some people read mail on a feature phone
      // or a client that refuses HTML, and this message is the whole reason
      // they would come back to the site.
      text: params.text,
      html: params.html,
    })
    return { ok: true, problem: null }
  } catch (error) {
    return { ok: false, problem: `Brevo refused it: ${(error as Error).message}` }
  }
}

/**
 * Tell an applicant what happened.
 *
 * NEVER THROWS. Every caller is announcing a decision that has already
 * committed, and a failed notification must not undo it.
 */
export async function notifyApplicant(params: {
  kind: NoticeKind
  businessName: string
  applicant: Applicant
  message?: string | null
}): Promise<NotifyResult> {
  const composed = composeMessage({
    kind: params.kind,
    businessName: params.businessName,
    applicantName: params.applicant.name,
    message: params.message,
  })

  const whatsappUrl = whatsappLink(params.applicant.phone, composed.body)

  if (!params.applicant.email) {
    return {
      emailed: false,
      whatsappUrl,
      emailProblem: 'No email address on this application.',
    }
  }

  const sent = await sendEmail({
    to: params.applicant.email,
    toName: params.applicant.name,
    subject: composed.subject,
    text: composed.body,
    html: asHtml(composed, accentFor(params.kind)),
  })

  return { emailed: sent.ok, whatsappUrl, emailProblem: sent.problem }
}

/** Exported so a test can render the HTML without sending anything. */
export function renderEmail(params: {
  kind: NoticeKind
  businessName: string
  applicantName: string | null
  message?: string | null
}): { subject: string; html: string; text: string } {
  const composed = composeMessage(params)
  return {
    subject: composed.subject,
    html: asHtml(composed, accentFor(params.kind)),
    text: composed.body,
  }
}

/**
 * WHY THERE IS NO SMS HERE.
 *
 * Every route to a Zimbabwean number is paid: a gateway account, a registered
 * sender ID and a per-message charge. There is no free tier that reaches a
 * Zimbabwean number reliably. That is a cost the owner should decide on with
 * the numbers in front of them, not something a notification helper quietly
 * introduces - so it is written down rather than half-built.
 */
