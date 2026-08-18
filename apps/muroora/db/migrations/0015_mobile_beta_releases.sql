-- Beta distribution: releases the owner controls, and feedback from testers.
--
-- WHY A TABLE AND NOT A CONSTANT SOMEWHERE
--
-- The APK download link is currently a 90-character Expo artifact URL living in
-- a memory note and a WhatsApp message. Every new build produces a new one, so
-- "where do I get the app" is answered differently each week and the wrong
-- answer keeps circulating. Worse, when a build turns out to be unsafe there is
-- no way to take it down - the last one containing the authentication bypass is
-- still downloadable by anybody who has the link.
--
-- Putting releases in the database means the owner publishes, deprecates or
-- BLOCKS a build from a browser, /beta always shows the current one, and
-- /beta/android always redirects to whatever is approved right now. Nothing in
-- the interface hard-codes a URL.
--
-- WHAT IS DELIBERATELY NOT HERE
--
-- The APK itself. §26 of the brief is right: binaries do not belong in
-- Postgres. `download_url` points at wherever the build actually lives - today
-- an EAS artifact, tomorrow a Play Store listing - and that indirection is the
-- entire point of the table.
--
-- No TestFlight URL is invented. iOS rows are allowed to exist with a null
-- download_url and status COMING_SOON, and the page says so honestly rather
-- than linking somewhere that does not exist.

/* -------------------------------------------------------------- releases */

CREATE TYPE "release_platform" AS ENUM ('ANDROID', 'IOS');

CREATE TYPE "release_status" AS ENUM (
  -- Written, not yet offered to anybody.
  'DRAFT',
  -- The one /beta and /beta/android currently serve.
  'PUBLISHED',
  -- Superseded. Still installable if somebody has the link, still listed in
  -- history, but not offered.
  'DEPRECATED',
  -- STOP INSTALLING THIS. Used when a build turns out to be unsafe: the
  -- download redirect refuses it and any app reporting this version is told to
  -- update before it can continue.
  'BLOCKED',
  -- iOS, until TestFlight actually exists.
  'COMING_SOON'
);

CREATE TABLE "mobile_releases" (
  "id"                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "platform"          "release_platform" NOT NULL,
  -- Semver as the app reports it, e.g. 0.2.0.
  "version"           text NOT NULL,
  -- Android versionCode / iOS build number. Monotonic, unlike version strings.
  "build_number"      integer,
  "release_date"      timestamptz NOT NULL DEFAULT now(),
  -- NULL is legitimate: a COMING_SOON row has nowhere to point yet.
  "download_url"      text,
  "release_notes"     text,
  "known_issues"      text,
  -- Anything below this is refused by the version check, whatever its status.
  "min_supported_version" text,
  "status"            "release_status" NOT NULL DEFAULT 'DRAFT',
  -- Update or be locked out, as opposed to "a newer one exists".
  "is_mandatory"      boolean NOT NULL DEFAULT false,
  "file_size_bytes"   bigint,
  "published_by"      uuid REFERENCES "users"("id"),
  "published_at"      timestamptz,
  "blocked_reason"    text,
  "created_by"        uuid REFERENCES "users"("id"),
  "created_at"        timestamptz NOT NULL DEFAULT now(),
  "updated_at"        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT "mobile_releases_platform_version_unique"
    UNIQUE ("platform", "version"),

  -- A published build people are told to install must have somewhere to
  -- install it from. The alternative is a download button that 404s, which is
  -- indistinguishable from the site being broken.
  CONSTRAINT "mobile_releases_published_needs_url"
    CHECK ("status" <> 'PUBLISHED' OR "download_url" IS NOT NULL),

  -- Blocking is a safety action and the reason is the record of why.
  CONSTRAINT "mobile_releases_blocked_needs_reason"
    CHECK ("status" <> 'BLOCKED' OR "blocked_reason" IS NOT NULL)
);

CREATE INDEX "mobile_releases_platform_status_idx"
  ON "mobile_releases" ("platform", "status");

-- EXACTLY ONE published build per platform, held by the database.
-- Two published Android rows means /beta/android has to guess, and whichever
-- it picks will be wrong for somebody.
CREATE UNIQUE INDEX "mobile_releases_one_published_per_platform"
  ON "mobile_releases" ("platform")
  WHERE "status" = 'PUBLISHED';

/* -------------------------------------------------------------- feedback */

CREATE TABLE "beta_feedback" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Null for somebody not signed in. A tester who cannot report a crash
  -- because they cannot log in is exactly the tester worth hearing from.
  "user_id"      uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "release_id"   uuid REFERENCES "mobile_releases"("id"),
  -- BUG, CRASH, SUGGESTION, SECURITY
  "kind"         text NOT NULL,
  "message"      text NOT NULL,
  -- What they were using, so a crash report is actionable.
  "app_version"  text,
  "device"       text,
  "contact"      text,
  /**
   * SECURITY REPORTS ARE PRIVATE.
   *
   * A report saying "the account screen lets anybody in" is a working exploit
   * until it is fixed. It must not appear on any shared list, so it is flagged
   * on the row and the listing query filters on the permission. This is the
   * same reasoning that keeps ID documents behind sensitive_documents.view.
   */
  "is_security"  boolean NOT NULL DEFAULT false,
  "status"       text NOT NULL DEFAULT 'NEW',
  "handled_by"   uuid REFERENCES "users"("id"),
  "handled_at"   timestamptz,
  "created_at"   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "beta_feedback_status_idx" ON "beta_feedback" ("status", "created_at");
CREATE INDEX "beta_feedback_security_idx"
  ON "beta_feedback" ("is_security") WHERE "is_security" = true;

/* -------------------------------------------------------------- settings */

INSERT INTO "platform_settings" ("key", "value", "description") VALUES
  ('public_beta_enabled', 'true'::jsonb,
   'Whether /beta is publicly reachable. Turn off to close the beta without deleting any release.'),
  ('beta_feedback_enabled', 'true'::jsonb,
   'Whether testers can submit feedback from /beta.')
ON CONFLICT ("key") DO NOTHING;

/* ------------------------------------------------------------------- RLS */

-- Same posture as every other table here: on, no policies, denied through
-- PostgREST. The app connects as the owning role and is unaffected.
-- DO NOT add FORCE ROW LEVEL SECURITY.
ALTER TABLE "mobile_releases" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "beta_feedback"   ENABLE ROW LEVEL SECURITY;

/* ------------------------------------------------------- the known state */

-- The build that actually exists, recorded rather than invented: Musuwo Beta
-- 0.2.0, the first APK with the authentication fix. Everything before it
-- contains the bypass, which is why min_supported_version is 0.2.0 - an older
-- install is refused rather than merely nudged.
INSERT INTO "mobile_releases"
  ("platform", "version", "build_number", "download_url", "release_notes",
   "min_supported_version", "status", "is_mandatory", "file_size_bytes", "release_date")
VALUES
  ('ANDROID', '0.2.0', 1,
   'https://expo.dev/artifacts/eas/w_QViq5NpyeCBPchcB0RscVrddtOzjfeHilYGWQrEwI.apk',
   E'Musuwo Beta, the first build that requires a real sign-in.\n\nThe account screen used to open without a password, and the business side showed a real merchant workspace to whoever was holding the phone. Both are fixed. Delete any earlier build you have.',
   '0.2.0', 'PUBLISHED', true, 89128960, now());

-- iOS has no build and no TestFlight. Recorded as COMING_SOON with no URL,
-- so the page can say so truthfully instead of guessing at a link.
INSERT INTO "mobile_releases"
  ("platform", "version", "status", "release_notes")
VALUES
  ('IOS', '0.0.0', 'COMING_SOON',
   'An iPhone build has not been made yet. There is no TestFlight invitation, and any link claiming to be one is not from Musuwo.');
