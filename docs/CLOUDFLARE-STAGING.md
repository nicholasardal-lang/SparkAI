# Cloudflare staging

This branch builds the latest GitHub Spark source for a separate Worker named `spark-staging`. It binds `DB` to the empty staging D1 database `spark-staging` (ID `44eebe4d-d137-4f04-a4d2-4f9db2e8d503`) in the owner's Cloudflare account. The database has migrations `0000` through `0008` applied. It does not read or change the existing Sites database or the public domain.

Build with `SPARK_DEPLOY_TARGET=cloudflare-staging node scripts/run-framework.mjs build`, then deploy the generated `dist/server/wrangler.json` with Wrangler from an authorized Cloudflare account. The staging flag removes the Sites-only plugin and replaces the local placeholder D1 ID with the real staging ID. Without the flag, the existing Sites/local behavior is unchanged.

R2 has not been activated for this Cloudflare account. The staging build intentionally has no `BUCKET` binding, so profile-picture storage is unavailable until the account owner starts R2, a private bucket is created, and the binding is added. Do not claim full feature parity before that check.

Set `OPENAI_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and optionally `ROBLOX_API_KEY` as Worker secrets in Cloudflare. Use Stripe **sandbox** credentials and a new webhook endpoint for the staging URL. Keep `REQUIRE_EMAIL_VERIFICATION=false` until email delivery is set up. Set `APP_ORIGIN` to the staging HTTPS URL. Never commit credentials or copy secrets from the Sites project into source.

Before any domain cutover, verify the staging health endpoint, sign-up and login, project creation, one AI request, Stripe sandbox checkout/webhook, credit grants, and cancellation handling. Take an export of the new D1 database and test restoring it into a separate database. The old Sites accounts and projects are test data and are intentionally not migrated.
