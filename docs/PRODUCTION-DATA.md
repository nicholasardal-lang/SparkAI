# Spark production data environment

The owner chose direct hosting in their Cloudflare account on October 1, 2026. See [Direct Cloudflare production](PRODUCTION-CLOUDFLARE.md) for the current resources, completed backup/recovery checks, and remaining cutover work. The Sites environment described below is now a private prototype; the public domain still serves the sandbox Site.

Spark's existing public Site (`appgprj_6aa4d00778888191884d99d667e57907`) is the sandbox environment. It contains test accounts, projects, Stripe sandbox events, and test entitlements. Do not copy its D1 rows or R2 objects into production. Its custom domain remains `sparkyourgame.com` until the production cutover is ready.

The separate production Site (`appgprj_6abb411a8e5c8191b1957e61468f8fa8`) declares D1 as `DB` and R2 as `BUCKET` in `.openai/hosting.json`. Sites owns the underlying Cloudflare resources. The production Site must remain private until its migrations, server secrets, authentication, billing, and recovery checks pass. A deployment to its generated Sites URL is not a domain cutover.

## Schema and data checks

The source contains ten ordered migrations, `drizzle/0000_*.sql` through `drizzle/0009_*.sql`. A production publish applies pending migrations. After the first publish, inspect the production Site's D1 tables, confirm the tables from `0009_studio_bridge.sql` exist, and verify that `users`, `billing_accounts`, `stripe_events`, and `projects` are empty. Do not seed real users with sandbox data. Confirm the production R2 binding is present and test storing/retrieving/deleting a disposable object before using profile pictures.

## Backup and restore procedure

The supported D1 Time Travel procedure, once the physical production database is identified and its Cloudflare account is accessible, is:

1. Record the D1 database name/ID, owning account, storage backend version, and retention period in the private operations record. `wrangler d1 info DATABASE_NAME` reports whether the database uses the `production` storage backend required for Time Travel.
2. Obtain and retain a current bookmark with `wrangler d1 time-travel info DATABASE_NAME` before any migration or recovery work. Export periodically to private storage outside the deployment account. `SPARK_D1_DATABASE=DATABASE_NAME node scripts/backup-database.mjs` can create a dated SQL export only when Wrangler is authenticated to the owning account.
3. To practice recovery without overwriting production, use a separate non-production D1 database: export a sample database, import it into the recovery database, and verify expected rows and application queries. Do not run a Time Travel restore against live production merely as a test; it overwrites the database in place.
4. For a real incident, stop writes, record the current bookmark, choose the recovery timestamp/bookmark, and have the authorized operator run `wrangler d1 time-travel restore DATABASE_NAME --bookmark=BOOKMARK`. Verify table counts, recent accounts, billing references, and app health before reopening writes. A restore can discard changes made after the selected point, so reconcile Stripe events and customer entitlements afterward.

Sites currently exposes bounded read-only database inspection but no D1 export, Time Travel, or restore operation through the available connector. The physical production database ID, Cloudflare backend version, retention window, independent export, and tested recovery remain launch blockers until access to the owning Cloudflare account or an equivalent supported backup/restore mechanism is available. Never claim recovery has been tested based only on this document.

## Cutover gate

Before assigning `sparkyourgame.com` to the production Site, install new production-only secrets privately, create live Stripe prices and a live webhook destination, complete an end-to-end test, and verify no Stripe sandbox key or webhook can grant production access. Then move the domain to the production Site, check health, signup/verification, checkout, entitlements, and recovery, and retain the sandbox Site separately for testing. Do not remove the current custom domain while the production Site is incomplete.
