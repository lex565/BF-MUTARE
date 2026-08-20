-- Give a merchant somewhere to put their own branding.
--
-- WHAT WAS MISSING
--
-- A storefront was a heading, a summary and a grid of product names. There was
-- no cover image column at all, and `logo_path` existed but no page drew it,
-- so a customer arriving on a shared link had nothing telling them whose shop
-- they were in except the name in the text.
--
-- WHY `tagline` AS WELL AS `summary`
--
-- `summary` is a paragraph and it is what the directory listing shows. A
-- storefront banner needs one line under the name. Reusing `summary` there
-- means either a wall of text over the cover image or truncating somebody's
-- description mid-sentence, which reads as broken rather than as brief.
--
-- WHY THESE ARE PATHS AND NOT URLS
--
-- Same rule as `product_images.path` and the verification documents: the
-- database stores a path within a bucket and the application builds the URL.
-- A stored URL bakes in the project host, so it survives exactly until the
-- storage bucket moves, and it lets somebody paste any address into a column
-- the site will then render.
--
-- Which is not hypothetical. MUR-BIZ-0019 currently has
-- `favicon_path = 'https://wa.me/c/263774215316'` - a WhatsApp catalogue link
-- typed into the icon field, because the merchant workspace labels it
-- "Favicon or square logo URL" and accepts any URL. The browser tries to load
-- a WhatsApp page as an image. The CHECK below stops the same thing happening
-- to the two new columns; `favicon_path` is left alone because correcting live
-- data somebody else typed is the owner's call, not a migration's.

ALTER TABLE "businesses"
  ADD COLUMN IF NOT EXISTS "cover_image_path" text,
  ADD COLUMN IF NOT EXISTS "tagline" text;--> statement-breakpoint

-- A path within a bucket, never an absolute URL, and never a traversal.
ALTER TABLE "businesses"
  ADD CONSTRAINT "businesses_branding_paths_are_paths"
  CHECK (
    ("cover_image_path" IS NULL OR ("cover_image_path" !~ '^[a-zA-Z][a-zA-Z0-9+.-]*:' AND "cover_image_path" !~ '\.\.'))
    AND
    ("logo_path" IS NULL OR ("logo_path" !~ '^[a-zA-Z][a-zA-Z0-9+.-]*:' AND "logo_path" !~ '\.\.'))
  );--> statement-breakpoint

-- One line, not a paragraph. Enforced so the banner layout cannot be broken by
-- somebody pasting their whole description into it.
ALTER TABLE "businesses"
  ADD CONSTRAINT "businesses_tagline_is_short"
  CHECK ("tagline" IS NULL OR char_length("tagline") <= 120);
