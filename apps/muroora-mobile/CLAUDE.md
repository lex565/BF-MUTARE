@AGENTS.md

# Muroora Beta handoff for Claude

The owner explicitly asked you to finish the Expo deployment through their
GitHub-connected Expo account. Preserve the completed UI and existing backend
work unless a deployment-only correction is required.

## Fixed release identity

- Product name: `Muroora Beta`
- Version: `0.1.0`
- Expo slug: `muroora-beta`
- iOS bundle ID: `co.muroora.mart`
- Android package: `co.muroora.mart`
- Expo SDK: `57`

Do not rename these values for the beta release.

## Work already completed

- Customer and rider mobile flows are interactive.
- Product sharing includes polished WhatsApp, Facebook, Instagram, and generic
  share icons in `src/SocialIcon.tsx`.
- The Account screen opens a protected admin flow. In development, the design
  can be reviewed through Account -> Admin tools -> Preview admin design.
- Real admin access verifies the Supabase bearer token and requires an
  `ADMIN` or `SUPER_ADMIN` application role.
- Mobile admin endpoints exist under `apps/muroora/app/api/mobile/` and reuse
  existing audited product, inventory, rider, dispatch, and handover logic.
- Expo/EAS profiles are already defined in `eas.json`.
- Public environment variable names are documented in `.env.example`.

## Validation already passed

- `npx tsc --noEmit` from `apps/muroora-mobile`
- `npx expo export --platform web`
- `npx expo config --type public`
- `npm run lint` and `npm run build` from `apps/muroora`

Re-run these checks before publishing, but do not redesign working screens.

## Current authentication and Git state

- A direct `npx eas-cli whoami --non-interactive` check returned
  `Not logged in`. The owner is signed into expo.dev through GitHub, but the
  local EAS CLI session has not yet received that authorization.
- Let the owner complete browser authentication themselves with:

  ```powershell
  cd D:\DEV\BF_Mutare\apps\muroora-mobile
  $env:npm_config_cache='D:\DEV\BF_Mutare\.npm-cache'
  npx eas-cli@latest login --browser
  npx eas-cli@latest whoami
  ```

- Never ask the owner to paste an Expo password or access token into chat.
- This Git worktree currently has no Git remote configured. Confirm the
  GitHub account and intended repository before adding a remote.
- The worktree contains unrelated modified and untracked files. Do not run
  `git add -A`, do not reset the worktree, and do not overwrite Claude/Codex
  work. Stage only the Muroora release files after reviewing `git status`.

## Publish through the owner's GitHub account

1. Verify GitHub authentication with `gh auth status`. If the intended repo is
   not discoverable, ask the owner for its name and whether it should be
   private. Prefer a private repository for this beta.
2. Add the confirmed GitHub repository as the remote. Commit and push only the
   reviewed Muroora mobile release plus its required mobile API support; never
   publish `.env*`, tokens, service-role keys, database URLs, build credentials,
   or unrelated workspace projects.
3. After `eas whoami` prints the owner's Expo username, run `eas init` from
   this directory. Allow Expo to write the real `extra.eas.projectId`; never
   invent or copy a project ID from another app.
4. Connect that EAS project to the pushed GitHub repository using the owner's
   Expo GitHub connection. If automating builds with GitHub Actions, store an
   Expo personal access token only as the `EXPO_TOKEN` repository secret; never
   commit it.
5. Configure the EAS preview/production environments with only:
   `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and
   `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
6. Ensure the matching Next backend is deployed before testing real admin
   calls. Do not place backend secrets in the mobile application.
7. Produce the free Android beta artifact with:

   ```powershell
   npx eas-cli@latest build --platform android --profile preview
   ```

8. For the owner's iPhone, keep Expo Go as the free testing path unless the
   owner supplies an active Apple Developer membership and explicitly requests
   an independently signed iOS/TestFlight build.
9. Hand back the GitHub repository URL, EAS project URL, build status, and
   install/QR link. Do not claim deployment until those URLs actually exist.

See `DEPLOYING.md` for the shorter operator checklist.
