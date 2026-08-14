/**
 * What BF Mutare actually does for you.
 *
 * SOURCE: the 2.0 build, `BF MUTARE CURRENTLY WORKING SITE.txt`, lines 610-708.
 * All nine services and their descriptions are the client's own copy, carried
 * over as written. The current site had no services list at all, which was the
 * single biggest thing missing from it — a buyer asking "do you handle duty?"
 * had nowhere to find the answer.
 *
 * Order is deliberate and differs from 2.0's. That build listed them in the
 * order they were thought of; here they run in the order a buyer meets them,
 * from first enquiry to the car on the driveway. The two free ones lead,
 * because "free" is the reason someone starts a conversation.
 */

export interface Service {
  title: string
  body: string
}

export const SERVICES: Service[] = [
  {
    title: 'Free inquiries',
    body: 'Have questions? Ask them before you commit to anything. There is no charge and no obligation to buy.',
  },
  {
    title: 'Free quotations',
    body: 'Tell us the vehicle you want and we price it up in full — no obligation, no fee for the quote.',
  },
  {
    title: 'Vehicle sourcing',
    body: 'We help you find the right car, matched to your preferences and your budget, from a wide selection of overseas stock.',
  },
  {
    title: 'Flexible payment plans',
    body: 'Spread the cost over up to 24 months, on terms set around what you can actually pay each month.',
  },
  {
    title: 'Invoice issuance and payment processing',
    body: 'Proper invoices and a payment process you can follow, so every stage of the transaction is on paper.',
  },
  {
    title: 'Vehicle clearing',
    body: 'We handle the customs side of bringing the vehicle in, which is the part that catches most private importers out.',
  },
  {
    title: 'Rebate facilitation',
    body: 'If your import qualifies for a duty rebate, we take you through claiming it rather than leaving you to it.',
  },
  {
    title: 'Home and port delivery',
    body: 'Collect at the port if you would rather, or have the vehicle brought to your door. Your choice, not ours.',
  },
  {
    title: 'Nationwide delivery',
    body: 'Anywhere in Zimbabwe. Mutare is where we are based, not the limit of where we operate.',
  },
]
