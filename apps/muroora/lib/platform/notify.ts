import { brand, siteOrigin } from '@/lib/brand'

/**
 * Telling an applicant something happened.
 *
 * THE PROBLEM THIS SOLVES. Asking a business for more information wrote the
 * message into the database and nothing else. The applicant only ever saw it
 * if they happened to return to the site - so an application could sit in
 * NEEDS_INFORMATION for weeks with each side believing the other was slow.
 * For a pilot that is the single most likely way an onboarding stalls.
 *
 * TWO CHANNELS, AND THE DIFFERENCE MATTERS
 *
 *   EMAIL is automatic. It sends the moment a reviewer acts, with no further
 *   action by anybody. It needs BREVO_API_KEY. Without that key nothing is
 *   sent and `emailed` comes back false - it does NOT throw, because failing
 *   to notify must never fail the underlying decision. An approval that
 *   happened is more important than an email that did not.
 *
 *   WHATSAPP is a link the REVIEWER clicks, which opens their own WhatsApp
 *   with the message already written. It is not automated and deliberately so:
 *   automated WhatsApp needs the Meta Business API, which costs money, takes
 *   weeks to approve, and requires a verified number Musuwo does not yet have.
 *   A wa.me link works today, costs nothing, and in Zimbabwe is the channel
 *   people actually read. The trade is that somebody has to press it.
 *
 * SMS IS DELIBERATELY ABSENT. There is no free path: it needs a paid gateway
 * (Twilio, Africa's Talking or similar) with per-message charges and a sender
 * ID registration. Adding one is a cost decision for the owner, not something
 * to slip in. See the note at the bottom.
 */

export interface NotifyResult {
  emailed: boolean
  /** A link the reviewer can click to send the same message on WhatsApp. */
  whatsappUrl: string | null
  /** Why the email did not go, when it did not. Shown to the reviewer. */
  emailProblem: string | null
}

/**
 * Turn a phone number into the digits WhatsApp expects.
 *
 * Zimbabwe numbers arrive as 0771234567, +263771234567, 263 77 123 4567 and
 * every spacing in between. wa.me wants country code and digits only.
 * Returns null rather than guessing when it cannot tell - a link to the wrong
 * person is worse than no link.
 */
export function waNumber(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null

  // 0771234567 -> 263771234567. Local numbers start 0 and are 9-10 digits.
  if (digits.startsWith('0') && digits.length >= 9 && digits.length <= 10) {
    return `263${digits.slice(1)}`
  }
  // Already has a country code.
  if (digits.length >= 11 && digits.length <= 15) return digits
  // 771234567, no leading zero.
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

/* ------------------------------------------------------------- messages */

interface Applicant {
  name: string | null
  email: string | null
  phone: string | null
}

/**
 * The words, written once, so email and WhatsApp cannot say different things.
 *
 * Plain, short, and it always says what to do next. Somebody reading this on a
 * phone should not have to work out whether they need to act.
 */
export function composeMessage(params: {
  kind: 'INFO_REQUESTED' | 'APPROVED' | 'REJECTED'
  businessName: string
  applicantName: string | null
  message?: string | null
}): { subject: string; body: string } {
  const who = params.applicantName?.split(' ')[0] ?? 'Hello'
  const link = `${siteOrigin()}/marketplace/apply`

  switch (params.kind) {
    case 'INFO_REQUESTED':
      return {
        subject: `${brand.name}: we need one more thing for ${params.businessName}`,
        body:
          `${who}, we have looked at your ${params.businessName} application and ` +
          `need one more thing before we can finish:\n\n` +
          `${params.message ?? ''}\n\n` +
          `Open ${link} to add it and send it back. Nothing you have already ` +
          `filled in is lost.\n\n` +
          `- ${brand.name}`,
      }
    case 'APPROVED':
      return {
        subject: `${params.businessName} is live on ${brand.name}`,
        body:
          `${who}, ${params.businessName} has been approved and is now on ` +
          `${brand.name}.\n\n` +
          `${params.message ? params.message + '\n\n' : ''}` +
          `Sign in at ${siteOrigin()} to add your products and prices. ` +
          `Customers can find you as soon as you do.\n\n` +
          `- ${brand.name}`,
      }
    case 'REJECTED':
      return {
        subject: `About your ${params.businessName} application`,
        body:
          `${who}, we are not able to list ${params.businessName} on ` +
          `${brand.name} at the moment.\n\n` +
          `${params.message ?? ''}\n\n` +
          `If that is something you can put right, you are welcome to apply ` +
          `again at ${link}.\n\n` +
          `- ${brand.name}`,
      }
  }
}

/* ---------------------------------------------------------------- email */

/**
 * Send through Brevo's API.
 *
 * Brevo rather than a new provider because it is already sending the password
 * reset, so it is one account, one sender identity and one free allowance (300
 * a day, far beyond a pilot). NO NEW PAID SERVICE.
 *
 * Never throws. A notification that fails must not roll back the approval it
 * was announcing.
 */
async function sendEmail(params: {
  to: string
  toName: string | null
  subject: string
  body: string
}): Promise<{ ok: boolean; problem: string | null }> {
  const key = process.env.BREVO_API_KEY
  if (!key) {
    return {
      ok: false,
      problem:
        'No email was sent - BREVO_API_KEY is not set on this deployment. Use the WhatsApp button instead.',
    }
  }

  const sender =
    process.env.BREVO_SENDER_EMAIL ?? 'no-reply@musuwo.online'

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': key,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: { name: brand.name, email: sender },
        to: [{ email: params.to, name: params.toName ?? undefined }],
        subject: params.subject,
        // Plain text as well as HTML: some people read mail on a feature
        // phone or a client that refuses HTML, and this message is the whole
        // reason they would come back.
        textContent: params.body,
        htmlContent: asHtml(params.subject, params.body),
      }),
    })

    if (!response.ok) {
      const detail = await response.text()
      return {
        ok: false,
        problem: `Brevo refused it (${response.status}). ${detail.slice(0, 160)}`,
      }
    }
    return { ok: true, problem: null }
  } catch (error) {
    return { ok: false, problem: `Could not reach Brevo: ${(error as Error).message}` }
  }
}

/** Tables and inline styles, because that is what email clients understand. */
function asHtml(subject: string, body: string): string {
  const paragraphs = body
    .split('\n\n')
    .map(
      (p) =>
        `<p style="margin:0 0 16px 0;font-size:16px;line-height:1.6;color:#3f3a30;">${escapeHtml(
          p,
        ).replace(/\n/g, '<br />')}</p>`,
    )
    .join('')

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f4f1ea;margin:0;padding:24px 12px;font-family:Helvetica,Arial,sans-serif;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#ffffff;border:1px solid #e3ded2;">
<tr><td style="padding:28px 28px 8px 28px;">
<p style="margin:0;font-size:20px;font-weight:bold;letter-spacing:-0.02em;color:#12271b;">${escapeHtml(brand.name)}</p>
</td></tr>
<tr><td style="padding:12px 28px 0 28px;">
<p style="margin:0 0 18px 0;font-size:18px;line-height:1.3;font-weight:bold;color:#005029;">${escapeHtml(subject)}</p>
${paragraphs}
</td></tr>
<tr><td align="center" bgcolor="#f4f1ea" style="background:#f4f1ea;padding:16px 28px;">
<p style="margin:0;font-family:'Courier New',monospace;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#8a8272;">${escapeHtml(brand.name)} &middot; Mutare</p>
</td></tr>
</table></td></tr></table>`
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/* --------------------------------------------------------------- public */

/**
 * Tell an applicant what happened.
 *
 * NEVER THROWS. Every caller is announcing a decision that has already
 * committed, and a failed notification must not undo it. The result says what
 * did and did not happen so the reviewer can fall back to WhatsApp.
 */
export async function notifyApplicant(params: {
  kind: 'INFO_REQUESTED' | 'APPROVED' | 'REJECTED'
  businessName: string
  applicant: Applicant
  message?: string | null
}): Promise<NotifyResult> {
  const { subject, body } = composeMessage({
    kind: params.kind,
    businessName: params.businessName,
    applicantName: params.applicant.name,
    message: params.message,
  })

  const whatsappUrl = whatsappLink(params.applicant.phone, body)

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
    subject,
    body,
  })

  return { emailed: sent.ok, whatsappUrl, emailProblem: sent.problem }
}

/**
 * WHY THERE IS NO SMS HERE.
 *
 * Every route to an SMS in Zimbabwe is paid: a gateway account, a registered
 * sender ID, and a charge per message. There is no free tier that reaches a
 * Zimbabwean number reliably. That is a cost the owner should decide on with
 * the numbers in front of them, not something a notification helper quietly
 * introduces - so it is written down here rather than half-built.
 *
 * If it is ever wanted, it belongs beside sendEmail with the same contract:
 * never throws, reports what happened, and the decision commits regardless.
 */
