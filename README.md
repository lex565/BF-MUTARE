# Pineberry Holdings — websites

Five sites, one codebase.

| App | What it is | Local | Live |
| --- | --- | --- | --- |
| `apps/pineberry` | Pineberry Holdings, the parent | `localhost:3000` | [pineberry.vercel.app](https://pineberry.vercel.app) |
| `apps/bfmutare` | BF Mutare, vehicle imports | `localhost:3001` | [bf-mutare.vercel.app](https://bf-mutare.vercel.app) |
| `apps/muroora` | Muroora Mart, retail and diaspora shopping | `localhost:3002` | [muroora-mart.vercel.app](https://muroora-mart.vercel.app) |
| `apps/speedmotors` | Speed Motor Engineering, since 1996 | `localhost:3003` | [speed-motors-tan.vercel.app](https://speed-motors-tan.vercel.app) |
| `apps/club420` | 420 Liquor Store | `localhost:3004` | [club-420.vercel.app](https://club-420.vercel.app) |
| `packages/ui` | Shared tokens, components and the brand registry | — | — |

**The group owns no working domains.** `pineberryholdings.com` and
`bfmutare.co.zw` do not resolve — not "point somewhere wrong", they do not
exist. Every canonical URL, sitemap, robots.txt and cross-link therefore uses
the Vercel address, read from `href` in `packages/ui/src/brands.ts`. Change it
there when a domain is bought and every one of those follows.

Do not write an aspirational domain into a canonical URL or a sitemap: it aims
search engines and link previews at nothing, silently.

Next.js 16 (App Router) · React 19 · Tailwind CSS 4 · TypeScript · npm workspaces.

## How the group hangs together

`packages/ui/src/brands.ts` is the single source of truth. Every company's
palette, activities, logo path and link live there once; the holdings site
renders its register from it, and `GroupBar` renders from it on every company
site. Add a fifth company there and it appears everywhere at once.

**Linking is one-directional, on purpose.** Each company site links up to
Pineberry (the group bar and the footer). Pineberry links out to all four.
Company sites do *not* link sideways to each other — they share an owner, not
an audience, and a header offering a garage on a liquor store's site makes each
one read as a directory page rather than its own shopfront.

`brandHref()` returns a company's production URL when it has one and its local
dev port when it does not, so cross-links work throughout the build. After the
first deploy, fill in the five `href` values in `brands.ts` and every link
resolves at once.

---

## ⚠ Before this goes live

Search the repo for `TODO` — every hit is a placeholder that will otherwise
ship as-is.

- [x] **`apps/bfmutare/app/data/site.ts`** — done. Phone, WhatsApp, email,
      address, hours and the three social links were recovered from the 2.0
      build and are live.
- [ ] **`FINANCE` in the same file** — **confirm the 24-month terms.** The
      headline is confirmed (2.0 advertised it), but deposit and eligibility
      are `null` and the site says "ask us" instead. Advertising credit terms
      is a claim you can be held to.
- [ ] **`STATS` in the same file** — `totalDelivered` and `operatingSince` are
      `null`, so those figures are hidden rather than guessed. 2.0 carried no
      counts either, so there was nothing to recover. Fill them in and they
      appear in the hero and on About.
- [x] **`apps/bfmutare/app/data/team.ts`** — done. Six real people from 2.0,
      confirmed correct by the client.
- [ ] **Team photographs.** 2.0 pointed at a `/Company Images/` folder that is
      not on this machine. Every `photo` is `null`, so the initials panel
      renders. Drop the files into `public/team/` and set the paths.
- [ ] **`apps/bfmutare/app/data/goals.ts`** — a draft for you to rewrite.
- [ ] **`packages/ui/src/brands.ts`** — Muroora Mart and Speed Motors need real
      descriptions and towns.
- [x] **Logo** — done, and it is the real one. Traced from
      `Images/bfmutarewhite_102403.png`. That file had its white background
      baked in as opaque pixels rather than as alpha, so the white was knocked
      out, the antialiased edges un-mixed back to solid colour, and the
      silhouette traced to a single path. Lives in `app/icon.svg` (favicon),
      `app/components/Logo.tsx` (header/footer, inlined) and
      `public/logo-mark.svg` + `public/logo.svg` for off-site use. Brand orange
      is `#d56422`, sampled from the artwork.
- [x] Favicon. BF Mutare uses the mountain mark; Pineberry is still the Next.js
      default.

### What was and was not salvageable

**From the 2.0 build (`D:\DEV\Website\BF MUTARE 2.0\`) — recovered and now
live:** phone `+263 774 850 107`, `bfmutare@gmail.com`, the Belmont Building
address and map coordinates, opening hours, Facebook / Instagram / TikTok, all
six staff with their real roles and quotes, and the nine services. Two files in
that folder were written a week apart and agree on every contact value, which
is why they were treated as confirmed.

**Not recovered:** the six team photographs and the customer car photos — both
lived in a `/Company Images/` folder that is not on this machine. The `.zip` in
that folder is a scraped Astro template, not BF's own site. The logo WAS found,
separately, at `Images/bfmutarewhite_102403.png`.

### Sourcing is not Japan-only

Every "we source from Japan" line was removed on 2026-08-14 — it is not true,
and it understates the business. Copy is deliberately country-neutral
("overseas", "the auction") until the client says which markets to name.
Naming the actual countries would be stronger than "Overseas" on the About
page, so that is worth asking them for.

The Japan references that remain are all the *supplier visit* in
`Partnership.tsx` — a real event with real photographs — plus one kei car
correctly described as Japanese. Those are facts, not sourcing claims.

**From the codebase before 2.0 — deliberately discarded:** its "contact number"
was `263123456789`, literally the digits 1 to 9; its team section had four names
on Unsplash stock portraits; its testimonials were invented. None of it was
carried over, and the real values above supersede it.

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
npm run dev:pineberry  # Pineberry     → localhost:3000
npm run dev:bf         # BF Mutare     → localhost:3001
npm run dev:muroora    # Muroora Mart  → localhost:3002
npm run dev:speed      # Speed Motors  → localhost:3003
npm run dev:420        # 420           → localhost:3004
npm run build          # builds all five
npm run lint           # lints all five
```

Run `npm install` from the **root**, never inside an app — the apps depend on
`@pineberry/ui` through the workspace and installing in a subfolder breaks it.

## BF Mutare page structure

Separate pages, not one long scroll. Home ends and hands off.

| Route | Contents |
| --- | --- |
| `/` | Video hero, 24-month plan, short pitch, three recent deliveries |
| `/deliveries` | Muted handover video header, seven identified vehicles + a wall of 52 handover photos |
| `/about` | Company description, the nine services, goals, the Japan visit |
| `/team` | Six people as tabs — one panel at a time |
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

### Vercel — five projects, one repo

Each app carries its own `vercel.json` with the right install command. Create
one Vercel project per app and set:

| Setting | Value |
| --- | --- |
| Root Directory | `apps/<name>` |
| Install Command | `npm install --prefix ../..` |
| Include files outside the root directory | **ticked** |

That last one is not optional: the apps import `@pineberry/ui` through the npm
workspace, and without it the build cannot see `packages/` and fails on the
import. The install command reaching up to the root is the same problem —
installing inside the app folder alone leaves the dependency unresolved.

There is deliberately no root `vercel.json` any more. The old one hardcoded
`npm run build:bf`, which would have built BF Mutare for all five projects.

### ⚠ This repo cannot be pushed to GitHub as it stands

`Images/video_2026-08-08_15-27-21.mp4` is 110MB and is already committed in
git history. GitHub hard-rejects any file over 100MB, so a push is refused
regardless of `.gitignore` — that rule only stops *new* files being added.

Fixing it needs either a history rewrite (`git filter-repo --path Images/
--invert-paths`) or Git LFS. Deploying straight from the Vercel CLI avoids the
problem entirely, because the CLI uploads the working tree and never touches
git history.

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
