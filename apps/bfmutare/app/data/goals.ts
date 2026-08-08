/**
 * Company goals, shown on the About page.
 *
 * ⚠ THESE ARE A DRAFT FOR YOU TO REWRITE, not statements of fact I gathered.
 *   They are directional rather than numeric on purpose — I will not invent a
 *   target like "500 vehicles by 2027", because a number nobody at BF Mutare
 *   agreed to is a promise to customers you never made.
 *
 * Replace the wording with what you actually intend. If a goal has a real
 * figure or deadline behind it, put it in — a specific goal is far stronger
 * than a general one, but only you can supply the specifics.
 */

export interface Goal {
  title: string
  body: string
}

export const GOALS: Goal[] = [
  {
    title: 'Make the paperwork the easy part',
    body: 'Duty, clearance and registration are where most import stories go wrong. We want a customer to never once have to chase a document themselves.',
  },
  {
    title: 'Put a car within reach of more people',
    body: 'Spreading payment over twenty-four months is the start of that, not the end of it. The aim is that owning a decent vehicle is a plan, not a windfall.',
  },
  {
    title: 'Keep the whole chain visible',
    body: 'From the auction sheet in Japan to the plate on the bumper, a customer should be able to see where their car is and what stage it is at.',
  },
  {
    title: 'Grow without dropping the standard',
    body: 'More vehicles a month means nothing if handovers start slipping. We would rather move steadily and keep the reputation the business was built on.',
  },
]
