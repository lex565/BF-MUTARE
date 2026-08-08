# Pineberry Holdings — websites

Two sites, one codebase.

| App | What it is | Local | Intended domain |
| --- | --- | --- | --- |
| `apps/pineberry` | Pineberry Holdings, the parent | `localhost:3000` | pineberryholdings.com |
| `apps/bfmutare` | BF Mutare, Japanese vehicle imports | `localhost:3001` | bfmutare.co.zw |
| `packages/ui` | Shared tokens and components | — | — |

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · TypeScript · npm workspaces.

---

## ⚠ Before this goes live

Search the repo for `TODO` — every hit is a placeholder that will otherwise
ship as-is.

- [ ] **`apps/bfmutare/app/data/site.ts`** — WhatsApp number, phone, email,
      street address, opening hours. WhatsApp must be full international with
      no punctuation: `263771234567`, not `077 123 4567`.
- [ ] **`FINANCE` in the same file** — **confirm the 24-month terms.** Deposit,
      instalments and eligibility are `null` and the site says "ask us" instead.
      Advertising credit terms is a claim you can be held to.
- [ ] **`STATS` in the same file** — `totalDelivered` and `operatingSince` are
      `null`, so those figures are hidden rather than guessed. Fill them in and
      they appear in the hero and on About.
- [ ] **`apps/bfmutare/app/data/team.ts`** — all five department heads are
      blank. Nothing was carried over from the old codebase; see below.
- [ ] **`apps/bfmutare/app/data/goals.ts`** — a draft for you to rewrite.
- [ ] **`packages/ui/src/brands.ts`** — Muroora Mart and Speed Motors need real
      descriptions and towns.
- [ ] **Logo.** The mark is a temporary `BF` in a plate-yellow box. Your staff
      wear a real logo in the Japan photos — send the file and I'll swap it in.
- [ ] Favicons. Both apps still use the Next.js default.

### Nothing was salvageable from the old code

The previous site's "contact number" was `263123456789` — literally the digits
1 to 9. Its team section had four names attached to Unsplash stock portraits,
and its testimonials were invented. None of it was carried over. The only
things worth confirming from it: it used `info@bfmutare.co.zw`, and claimed
"serving Zimbabwe since 2020".

### Why the deliveries have no prices or dates

These vehicles are **already with their owners** — this is a record of work
done, not a stock list. So there are no prices, no "available/sold" status, and
no timestamps. A handful of dated entries would make a business that has run
for years look like it started last month.

Make, model, colour and plate code were all read off the photographs. Anything
not visible in an image was left out rather than invented.

---

## Running it

```bash
npm install            # once, at the ROOT — workspaces hoist everything
npm run dev:bf         # BF Mutare  → localhost:3001
npm run dev:pineberry  # Pineberry  → localhost:3000
npm run build          # builds both
npm run lint           # lints both
```

Run `npm install` from the **root**, never inside an app — the apps depend on
`@pineberry/ui` through the workspace and installing in a subfolder breaks it.

## BF Mutare page structure

Separate pages, not one long scroll. Home ends and hands off.

| Route | Contents |
| --- | --- |
| `/` | Video hero, 24-month plan, short pitch, three recent deliveries |
| `/deliveries` | Seven identified vehicles + a wall of 52 handover photos |
| `/about` | Company description, goals, the Japan visit |
| `/team` | Five departments as tabs — one panel at a time |
| `/journal` | Blog listing (Sanity-ready) |
| `/contact` | Payment plan detail, contact card, how buying works |

Nav and footer live in `app/layout.tsx` so they persist across routes.

## Updating deliveries

`apps/bfmutare/app/data/deliveries.ts`.

- **FEATURED** — the labelled cards. Copy an entry, change the fields, drop
  photos in `public/featured/`.
- **GALLERY** — the 52-photo wall in `public/deliveries/`. Unlabelled on
  purpose; add a `label` to any entry as you confirm the vehicle and it shows
  on hover.

## The blog and the weekly figures

You chose **Sanity** (free tier). The seam is already in place:
`apps/bfmutare/app/data/journal.ts` exposes `getPosts()` / `getPost()` as async
functions, and the components are server components that already `await` them.
Swapping those two function bodies for Sanity queries is the entire migration —
no component changes.

**What's needed from you:** create a project at sanity.io and send the project
ID and dataset name. I can't create the account for you.

Until then `POSTS` is empty and the journal renders an honest empty state
rather than three invented articles.

## Deploying

### Vercel — two projects, one repo

| Setting | Pineberry | BF Mutare |
| --- | --- | --- |
| Root Directory | `apps/pineberry` | `apps/bfmutare` |
| Install Command | `npm install --prefix ../..` | `npm install --prefix ../..` |

Tick **"Include files outside the root directory"** on both, or the build can't
see `packages/ui` and fails on the `@pineberry/ui` import.

### Namecheap — domains only

Namecheap shared hosting can't run Next.js server-side, which is why hosting is
on Vercel and Namecheap only holds the domains.

1. Domain List → *Manage* → **Nameservers** → set to **Namecheap BasicDNS**.
   The Advanced DNS tab is ignored while custom nameservers are set — this is
   the step people miss.
2. **Advanced DNS** → add the records Vercel shows under *Project → Settings →
   Domains*. **Use whatever Vercel displays**, not values copied from a guide —
   they have changed before, and a stale IP is a silently dead domain.
3. Delete Namecheap's default parking-page redirect and CNAME for `@` and
   `www`, or they fight the new records.

---

## Design notes

Two brands, one skeleton, opposite temperature. Shared: spacing rhythm, type
scale, easing curves, numbered eyebrows, scroll reveals
(`packages/ui/src/tokens.css`). Per brand: colour and typeface only.

| | Pineberry | BF Mutare |
| --- | --- | --- |
| Ground | Warm paper `#f6f3ec` | Near-black `#131210` |
| Accent | Pineberry seed red `#c4402c` | Number-plate yellow `#efc63b` |
| Display | Fraunces (`WONK` axis on) | Archivo (expanded, uppercase) |
| Reads as | Annual report | Forecourt |

Load-bearing decisions:

- **No pure `#fff` or `#000`.** Warm paper, warm black. Pure white-on-black is
  the loudest tell of a template.
- **Plate yellow is a signal, never a gradient.** It's the colour a Zimbabwean
  driver reads as "vehicle" before reading a word, lifted off the trade plates
  in your own photos.
- **The hero video must stay `muted` + `playsInline`.** Not stylistic —
  browsers block autoplay with sound, and iOS forces fullscreen without
  `playsInline`. The `<video>` carries a real photo as `poster` and gets no
  `src` at all under reduced-motion or save-data, so a 3.5MB loop never lands
  on someone's mobile data.
- **Team tabs follow the ARIA tabs pattern** — arrow keys move between tabs,
  Home/End jump to the ends, only the active tab is in the tab order.
- **`@theme static`** in `tokens.css` is required. Tailwind drops theme
  variables it can't see used in a class name, and several are read from inline
  styles. Without `static`, `--duration-base` silently resolves to nothing.

## Not yet built

- Sanity wiring (needs your project ID).
- Per-vehicle detail pages — `vehicleBySlug()` is ready for `/deliveries/[slug]`.
- Muroora Mart and Speed Motors sites.
- Sitemap, robots.txt, Open Graph images.
- The 115MB video in `Images/` is unused and far too large for the web; the
  3.5MB one is the hero.
