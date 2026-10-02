# Direct Cloudflare production

Last verified October 1, 2026 (America/Los_Angeles).

## Environments and ownership

- Public sandbox: Sites project `appgprj_6aa4d00778888191884d99d667e57907`, serving `sparkyourgame.com`. It still contains test accounts and Stripe sandbox data. No domain cutover has occurred.
- Private Sites prototype: `appgprj_6abb411a8e5c8191b1957e61468f8fa8`. Its inspected user, project, billing-account, and Stripe-event tables are empty. Sites controls its underlying resources; its available connector does not expose exports or recovery controls.
- The owner chose direct Cloudflare production hosting on October 1 so the business can operate exports and recovery. Cloudflare account: `3ac4fbbc9d9134734e4ddd5bd449d0e1`.

Do not migrate sandbox data. The owner declined a sandbox export. The Sites manifest is not the configuration for direct Cloudflare hosting.

## Resources

| Purpose | Name | ID / binding | Verified status |
| --- | --- | --- | --- |
| Production D1 | `spark-production` | `599871d7-f879-4712-85f2-25f2a407f082` / `DB` | Production backend, WNAM; all ten migrations applied |
| Recovery D1 | `spark-recovery-drill` | `27b9e5f6-ef2d-4cd1-ab1e-82398d2dc07b` / `RECOVERY` | SQL import and Time Travel practice passed |
| Existing staging D1 | `spark-staging` | `44eebe4d-d137-4f04-a4d2-4f9db2e8d503` | Not modified |
| Planned R2 | `spark-production-assets` | `BUCKET` | Not provisioned; owner must enable R2 usage billing first |

`wrangler.production.jsonc` records the production resources but is not yet deployed. It has no domain route and disables workers.dev/preview URLs. Its R2 declaration is a planned name, not proof of provisioning. `wrangler.recovery.jsonc` is only for isolated drills and must never be bound to the public application.

Remote production checks confirmed ten rows in `d1_migrations` and zero rows in `users`, `projects`, `billing_accounts`, and `stripe_events`.

## Verified backup and recovery

The production schema was exported to an ignored local SQL file outside the Cloudflare account and imported into `spark-recovery-drill`. All 37 non-internal schema objects matched; ten migrations and empty user/project tables were verified.

A disposable recovery-only table was bookmarked with a `before-recovery` value, changed to `after-change`, and restored using D1 Time Travel. A new query confirmed `before-recovery`. The probe table was removed afterward. Production was not restored or populated with drill data.

The drill was also repeated with synthetic linked user, project, conversation, subscription, credit-bucket, ledger, and Stripe-event records. A separate remote validation database recovered the project, conversation, active subscription, and 1,200 credits; migration and username-claim counts matched and `PRAGMA foreign_key_check` returned no errors. No live provider calls or real payments were used.

After verification, synthetic fixture rows were removed from the recovery database and the temporary validation database was deleted. The recovery database retains its ten migrations and has no users, projects, or credit-ledger rows. The restore script's nonempty-target refusal was also verified without changing the target.

Cloudflare documents seven days for Workers Free and 30 days for Workers Paid: https://developers.cloudflare.com/d1/reference/time-travel/. The authorized CLI/API did not confirm the account's billing plan. Until the dashboard confirms it, use seven days as the conservative policy; do not claim the exact account retention window is verified.

### Export

After signing in to the owning account with Wrangler:

```sh
node scripts/backup-database.mjs
```

The script uses `wrangler.production.jsonc`, defaults to `spark-production`, and writes a uniquely dated SQL bundle under ignored `.wrangler/backups/`. Keep the combined `.sql` and its `.schema.sql`, `.restore-schema.sql`, `.data.sql`, and `.triggers.sql` companions together. An optional first argument selects another private output path. `SPARK_D1_DATABASE` and `SPARK_WRANGLER_CONFIG` can explicitly select another environment. Keep independent private copies and transfer them securely when changing computers. Never commit exports or login credentials. Do not run migrations between the schema and data exports.

The raw full D1 export failed on linked rows because inserts preceded referenced table definitions. A combined reordered import also produced a Cloudflare reset error. The verified remote procedure imports the schema without triggers, then data, then triggers as three stages. This prevents username-claim triggers from duplicating restored rows. The combined SQL file was separately replayed successfully in SQLite; use the staged command below for D1.

### Recovery drill

Only use an empty isolated recovery database for a new import:

```sh
node scripts/restore-database.mjs spark-recovery-drill wrangler.recovery.jsonc PRIVATE_BACKUP.sql
```

The script refuses production and nonempty targets, imports schema/data/triggers in order, and checks foreign keys. Create a fresh isolated target when the existing drill database is populated; do not point this tool at the production database. Compare schemas, migration records, row counts, ownership, credits, and application queries afterward. Repeat periodically as schema and data change.

### Real incident

1. Stop application writes and background jobs. Record a current bookmark with `npx wrangler d1 time-travel info spark-production --config wrangler.production.jsonc --json`.
2. Identify the exact recovery point and data that will be discarded; preserve a current export when possible.
3. The authorized operator runs `npx wrangler d1 time-travel restore spark-production --config wrangler.production.jsonc --bookmark BOOKMARK`. It overwrites production in place. Retain the returned previous bookmark for undo.
4. Verify schema, accounts, projects, ownership, credits, and recent payments. Reconcile Stripe events after the restored point before reopening writes.

## Remaining work

1. Confirm the Workers plan and Time Travel window in the owner's dashboard.
2. If the owner enables R2, create the private Standard bucket and test a disposable object's write/read/delete. Budget alerts notify but do not cap spend; application quotas are a separate control.
3. Keep private backup bundles, schedule exports once deployment is operating, and repeat the verified recovery practice periodically.
4. Prepare a direct Cloudflare application build/deployment with server secrets, email verification, live Stripe prices/webhook, and sandbox-payment rejection.
5. Test end to end before moving `sparkyourgame.com`. After moving it, verify the actual Worker bindings and app health. Retain sandbox environments separately.

The production-data step remains incomplete until storage, plan confirmation, and the website's production bindings/cutover are verified.
