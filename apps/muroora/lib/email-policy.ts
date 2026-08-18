import { resolveMx } from 'node:dns/promises'

/**
 * Keep throwaway addresses out of the account table.
 *
 * WHY THIS EXISTS. An account here is not just a login. It carries a cart, an
 * order history, delivery addresses, and - once a role is granted - staff or
 * rider access. A ten-minute mailbox breaks all of that in one direction: the
 * account survives, the address does not. When the person cannot receive a
 * password reset there is no way back in that does not involve somebody at the
 * shop manually proving who they are. It also makes registration free and
 * unlimited, which is what turns "somebody made an account" into "somebody
 * made four hundred accounts".
 *
 * WHAT IT DELIBERATELY DOES NOT DO:
 *
 *   It does not touch SIGNING IN. Any account that already exists keeps
 *   working, including ones opened before this file did. Locking somebody out
 *   of an account they already own, retroactively, over the address they used
 *   to open it, would be a worse outcome than the one being prevented. If a
 *   throwaway account needs to go, that is a decision for an admin looking at
 *   a specific row, not for a sign-in form.
 *
 *   It does not touch the PASSWORD RESET form, which must keep answering every
 *   address identically. Saying "that domain is not allowed here" tells
 *   whoever is typing that the address is otherwise unknown, and turns the
 *   form into a way of discovering who has an account.
 *
 * TWO CHECKS, IN ORDER OF CERTAINTY.
 *
 *   1. A list of known disposable-mail domains. Fast, offline, definitive.
 *      Matched on the domain and on any parent of it, because most of these
 *      services hand out unlimited subdomains - block `mailinator.com` and
 *      `x.mailinator.com` is still open otherwise.
 *
 *   2. An MX lookup. A domain that publishes no mail server cannot receive the
 *      confirmation, the receipt or the reset, whoever owns it. This catches
 *      the throwaway registered this morning that no list has yet, and it
 *      catches plain typos - gmail.cm, yaho.com - which in practice is the
 *      more common case by far.
 *
 * The MX check FAILS OPEN. If DNS is slow, blocked, or the deployment cannot
 * reach a resolver, the answer is to let the registration through, not to
 * refuse every customer because our own network is having a bad afternoon. A
 * throwaway address is an annoyance; a shop whose sign-up form is broken is
 * lost money. It only refuses on a definitive answer that the domain has no
 * mail servers at all.
 */

/**
 * Known disposable, burner and forwarding-only mail domains.
 *
 * Not exhaustive and never will be - there are tens of thousands and more
 * every week. It covers the services somebody actually reaches for, which is
 * the ones a search for "temp mail" returns on the first page. Treat it as a
 * speed bump that also catches the lazy bulk case, not as a wall.
 *
 * Add to it rather than replacing it. Entries are bare registrable domains,
 * lower case, no leading dot: subdomains are handled by the matcher.
 */
const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  // The ones with a front page and a "copy address" button.
  'mailinator.com',
  'mailinator.net',
  'mailinator.org',
  'notmailinator.com',
  'maildrop.cc',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'guerrillamail.biz',
  'guerrillamail.de',
  'grr.la',
  'sharklasers.com',
  'spam4.me',
  'temp-mail.org',
  'temp-mail.io',
  'tempmail.com',
  'tempmail.net',
  'tempmail.plus',
  'tempmailo.com',
  'tempmailaddress.com',
  'tempr.email',
  'tmpmail.org',
  'tmpmail.net',
  'tmail.ws',
  'tmails.net',
  'minuteinbox.com',
  '10minutemail.com',
  '10minutemail.net',
  '10minemail.com',
  '20minutemail.com',
  'my10minutemail.com',
  '33mail.com',
  'yopmail.com',
  'yopmail.net',
  'yopmail.fr',
  'moakt.com',
  'moakt.cc',
  'moakt.ws',
  'mohmal.com',
  'mailnesia.com',
  'mailcatch.com',
  'mailexpire.com',
  'mailfreeonline.com',
  'mailmetrash.com',
  'mailnull.com',
  'mailsac.com',
  'mailtemp.info',
  'mail-temp.com',
  'mail7.io',
  'mailpoof.com',
  'mailgolem.com',
  'mailhz.me',
  'mailtemporaire.fr',
  'mailtothis.com',
  'mailde.de',
  'emailondeck.com',
  'emailfake.com',
  'email-fake.com',
  'mail-fake.com',
  'fakemail.net',
  'fakeinbox.com',
  'throwawaymail.com',
  'trashmail.com',
  'trashmail.de',
  'trashmail.net',
  'trashmail.ws',
  'trash-mail.com',
  'wegwerfmail.de',
  'wegwerfmail.net',
  'wegwerfmail.org',
  'dispostable.com',
  'discard.email',
  'discardmail.com',
  'discardmail.de',
  'spamgourmet.com',
  'spambox.us',
  'spamex.com',
  'spamhole.com',
  'spam.la',
  'spamavert.com',
  'spamcorptastic.com',
  'spamday.com',
  'spamfree24.com',
  'spamfree24.de',
  'spamfree24.org',
  'spamherelots.com',
  'spaml.de',
  'spamspot.com',
  'sendspamhere.com',
  'getnada.com',
  'nada.email',
  'inboxkitten.com',
  'burnermail.io',
  'burner.email',
  'anonaddy.me',
  'anonaddy.com',
  'harakirimail.com',
  'incognitomail.com',
  'jetable.org',
  'jetable.fr.nf',
  'cool.fr.nf',
  'nospam.ze.tc',
  'nomail.xl.cx',
  'mega.zik.dj',
  'speed.1s.fr',
  'linshiyouxiang.net',
  'luxusmail.org',
  'mytemp.email',
  'onetimeemail.com',
  'owlymail.com',
  'rcpt.at',
  'sofort-mail.de',
  'instant-mail.de',
  'tempinbox.com',
  'tempemail.net',
  'tempsky.com',
  'trbvm.com',
  'vomoto.com',
  'yepmail.net',
  'zetmail.com',
  'zoemail.com',
  'dropmail.me',
  'dropjar.com',
  'firemailbox.club',
  'flurred.com',
  'freeml.net',
  'gettempmail.com',
  'mailboxy.fun',
  'mvrht.net',
  'nowmymail.com',
  'pokemail.net',
  'proxymail.eu',
  'put2.net',
  'quickinbox.com',
  'rppkn.com',
  'safetymail.info',
  'selfdestructingmail.com',
  'shitmail.me',
  'shortmail.net',
  'sneakemail.com',
  'snkmail.com',
  'sogetthis.com',
  'supergreatmail.com',
  'suremail.info',
  'teleworm.us',
  'thisisnotmyrealemail.com',
  'tradermail.info',
  'walkmail.net',
  'wuzup.net',
  'xemaps.com',
  'xoxy.net',
  'binkmail.com',
  'bobmail.info',
  'chammy.info',
  'devnullmail.com',
  'letthemeatspam.com',
  'mailin8r.com',
  'reallymymail.com',
  'crazymailing.com',
  'cs.email',
  'byom.de',
  'nwytg.net',
  'tafmail.com',
  'clrmail.com',
  // Fake-identity generators. These publish MX and accept mail, so the list is
  // the only thing that catches them.
  'einrot.com',
  'fleckens.hu',
  'gustr.com',
  'jourrapide.com',
  'rhyta.com',
  'superrito.com',
  'armyspy.com',
  'cuvox.de',
  'dayrep.com',
])

/** The outcome of checking an address, with wording a customer can act on. */
export type EmailVerdict = { ok: true } | { ok: false; reason: string }

const MX_TIMEOUT_MS = 2_500

/** The part after the @, lower case, trailing dot removed. */
function domainOf(email: string): string {
  const at = email.lastIndexOf('@')
  if (at < 0) return ''
  return email
    .slice(at + 1)
    .trim()
    .toLowerCase()
    .replace(/\.$/, '')
}

/**
 * Is this domain, or any parent of it, on the list?
 *
 * `a.b.mailinator.com` walks down to `mailinator.com` and matches. It stops
 * before the last label, so a bare public suffix is never tested on its own.
 */
export function isDisposableDomain(domain: string): boolean {
  const labels = domain.split('.')
  for (let i = 0; i < labels.length - 1; i += 1) {
    if (DISPOSABLE_DOMAINS.has(labels.slice(i).join('.'))) return true
  }
  return false
}

/**
 * Does the domain publish anywhere to deliver mail?
 *
 * Returns `true` on any doubt. Only a definitive "this domain does not exist"
 * or "it exists and publishes no mail server" comes back false - see the
 * fail-open note at the top of the file.
 */
export async function domainCanReceiveMail(domain: string): Promise<boolean> {
  try {
    const records = await Promise.race([
      resolveMx(domain),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), MX_TIMEOUT_MS),
      ),
    ])
    return records.length > 0
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code
    // ENOTFOUND: no such domain. ENODATA: the domain exists but publishes no
    // MX record. Both mean nothing we send can ever arrive.
    if (code === 'ENOTFOUND' || code === 'ENODATA') return false
    // Anything else - a timeout, SERVFAIL, no resolver reachable - is our
    // problem, not the customer's.
    console.warn('[email-policy] MX lookup inconclusive for', domain, code)
    return true
  }
}

/**
 * The gate used when an account is being CREATED.
 *
 * Never call this on sign-in or on the password-reset form. See the top of the
 * file for why both would do harm.
 */
export async function checkSignUpEmail(email: string): Promise<EmailVerdict> {
  const domain = domainOf(email)

  if (!domain || !domain.includes('.')) {
    return { ok: false, reason: 'That does not look like an email address.' }
  }

  if (isDisposableDomain(domain)) {
    return {
      ok: false,
      reason:
        'That is a temporary email service. Please use an address you will ' +
        'still be able to open next month: your receipts, delivery updates ' +
        'and password resets all go there.',
    }
  }

  if (!(await domainCanReceiveMail(domain))) {
    return {
      ok: false,
      reason:
        `Nothing can be delivered to ${domain} - it has no mail server. ` +
        'Check the spelling of the part after the @.',
    }
  }

  return { ok: true }
}
