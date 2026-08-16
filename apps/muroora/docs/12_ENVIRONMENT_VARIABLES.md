# 12 — Environment variables

The complete template is `.env.example`; real values belong only in
`.env.local` or the deployment host's secret manager.

Rider-specific flag:

- `ENABLE_SENSITIVE_RIDER_VERIFICATION=false` — server-only. Keep false until
  the owner has approved the legal basis, collection scope, access controls,
  retention/deletion policy, and private document storage workflow.

The native Expo prototype currently uses local demo state and therefore needs
no secret. When connected to production auth, its public API/Supabase values
must use Expo public configuration; database URLs and the Supabase service-role
key must never be bundled into the app.
