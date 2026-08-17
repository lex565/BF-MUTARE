# Deploying Musuwo on the existing Expo project

Do not deploy until the owner answers the mandatory questions in
`../../CLAUDE_SME_MARKETPLACE_BACKEND_HANDOFF.md` and explicitly approves the
plan.

Musuwo reuses the EAS project that previously hosted the Muroora beta:

- owner: `muroora-mart`
- project ID: `1da99634-840e-4cf1-8e23-60e6cb560d68`
- update URL: `https://u.expo.dev/1da99634-840e-4cf1-8e23-60e6cb560d68`

Never run `eas init` or create another Expo project. First run `eas whoami` and
`eas project:info` to verify the existing linkage. Ask whether the new native
IDs `zw.co.musuwo.app` should remain or the old Muroora IDs must be restored for
an in-place upgrade; changing IDs creates a separate installed application.

Configure `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_SUPABASE_URL` and
`EXPO_PUBLIC_SUPABASE_ANON_KEY` in EAS preview/production environments. Never
expose database URLs, payment secrets or the Supabase service-role key.

Deploy and smoke-test the existing Next backend first. Then build the Android
internal preview with:

`eas build --platform android --profile preview`

An installable iOS build requires valid Apple signing/provisioning. Validate
the icon and splash with an installed preview/production binary; Expo Go and
the web preview do not reproduce the native launch experience accurately.

Production builds, store submission and OTA publication require separate
explicit approval after backend migrations, RLS tests and device smoke tests
have been reported. Keep rollback instructions and feature flags ready.
