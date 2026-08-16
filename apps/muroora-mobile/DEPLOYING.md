# Deploying Muroora Beta 0.1.0

## Free iPhone testing now

Use Expo Go. From this directory run `npx expo start --tunnel`, install Expo Go
on the iPhone, and scan the QR code. This does not require an Apple Developer
membership. The computer and Metro process must remain running during the test.

## EAS release preparation

The `preview` and `production` profiles are in `eas.json`. Before the first EAS
command:

1. Run `eas login` using the owner's Expo account.
2. Run `eas init` and allow it to add the real `extra.eas.projectId` and update
   URL. Never invent this ID.
3. Add `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL`, and
   `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the EAS preview/production environments.
4. Deploy the matching Next backend before testing protected admin endpoints.
5. Build Android preview with `eas build --platform android --profile preview`.

An installable iOS build requires Apple signing/provisioning. That normally
requires the paid Apple Developer Program; Expo Go remains the no-cost iPhone
test path. App Store submission is not part of the beta test deployment.

Only public Expo/Supabase values belong in the mobile environment. Database
URLs, direct URLs, and the Supabase service-role key must remain server-only.
