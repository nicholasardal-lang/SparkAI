# Spark handoff to a new device

Prepared October 1, 2026, for continuing in a new Codex chat on a MacBook M4 Pro. Recheck remote state before acting: this document records the last verified state, not an automatic deployment status feed.

## Copy this into the new Codex chat

Continue helping me ship Spark at https://sparkyourgame.com. The source repository is https://github.com/nicholasardal-lang/SparkAI. Clone or update the latest `main`, read this document and `docs/PRODUCTION-CLOUDFLARE.md`, and inspect applicable AGENTS.md files before changes. I am moving from a Windows desktop to a MacBook M4 Pro. Guide me one step at a time; finish the clean production data environment before moving on to unrelated launch tasks or features.

I chose to host production in my own Cloudflare account so I can control backups and recovery. Do not assume that a GitHub push deploys the website. Verify actual hosting, domains, secrets and resource bindings. Do not expose keys in chat or Git, overwrite collaborator changes, force-push, or move the public domain to an incomplete deployment. Read the remaining-work section below, explain the immediate next action, and continue the authorized production setup.

## Current verified state

- Repository `main` contains the owned-Cloudflare resource configuration and recovery tooling from commit `3d0e7135535b9841cbae79b0447bb6cc96d35504`. A later documentation-only commit adds this handoff. Pull latest `main` instead of pinning the older commit.
- The public domain still serves the existing Sites sandbox environment. No direct Cloudflare Worker has been deployed and no domain cutover has occurred.
- The owner declined exporting or carrying over sandbox accounts/projects. Keep sandbox customers/payments separate from real production users. No sandbox data has been imported into the fresh production database.
- Resend verification and password-reset emails were tested successfully on the existing public deployment. This does not mean the new Cloudflare deployment has its secrets configured.
- The production-data step is NOT complete. D1 creation, migrations, backups and recovery practice are complete; R2, retention confirmation and actual production application bindings/cutover remain.

## Resources to preserve and verify

Cloudflare account: `3ac4fbbc9d9134734e4ddd5bd449d0e1` (the account owning the domain).

| Purpose | Resource | Identifier / status |
| --- | --- | --- |
| Fresh production D1 | `spark-production` | `599871d7-f879-4712-85f2-25f2a407f082`; WNAM; intended Worker binding `DB` |
| Isolated recovery D1 | `spark-recovery-drill` | `27b9e5f6-ef2d-4cd1-ab1e-82398d2dc07b`; never bind to public app |
| Existing staging D1 | `spark-staging` | `44eebe4d-d137-4f04-a4d2-4f9db2e8d503`; untouched |
| Planned private Standard R2 | `spark-production-assets` | Intended binding `BUCKET`; NOT provisioned |
| Existing public Sites project | Sandbox | `appgprj_6aa4d00778888191884d99d667e57907`; currently serves `sparkyourgame.com` |
| Private Sites prototype | Not the final hosting target | `appgprj_6abb411a8e5c8191b1957e61468f8fa8`; `https://spark-your-game-production.puriux.chatgpt.site/` |

The D1 migration count is TEN (`0000` through `0009_studio_bridge.sql`), not the nine in the earlier checklist. Verified production counts: ten migration records and zero users, projects, billing accounts and Stripe events.

## Recovery completed

Read `docs/PRODUCTION-CLOUDFLARE.md` for exact procedures. Verified both remote SQL import and D1 Time Travel on an isolated database. Recovery of synthetic linked account, project, conversation, subscription, credit bucket, ledger and Stripe-event records passed, including 1,200 recovered credits, username claims and foreign-key checks. Production was never rolled back or populated with fixture data. Removed synthetic fixture rows afterward; deleted the temporary validation database. The recovery database retains its schema and migrations.

Operational files:

- `wrangler.production.jsonc`: intended direct production configuration; not deployed, no domain route, workers.dev and preview URLs disabled, planned R2 binding still unresolved.
- `wrangler.recovery.jsonc`: isolated drill database configuration.
- `scripts/backup-database.mjs`: exports a private SQL bundle; defaults to production and redacts temporary export download credentials from logs.
- `scripts/backup-format.mjs`: separates schema and triggers without parsing user content.
- `scripts/restore-database.mjs`: three-stage schema/data/trigger import into an EMPTY nonproduction target; refuses production and nonempty targets. The existing recovery database is not an empty target.
- `tests/backup-format.test.mjs`: linked records, SQL-looking conversation text, foreign keys and username-trigger regression checks.

Raw combined D1 exports/imports failed on linked records; a combined reordered import also caused a Cloudflare reset error. The verified remote restore method imports schema without triggers, then data, then triggers. Keep all backup companions together. Do not retry the failed combined bulk import as the recommended procedure.

Time Travel retention depends on the Workers plan. Exact account plan/window is unconfirmed; use seven days conservatively until dashboard verification. Recovery practice passed, but exports are not yet scheduled.

## Remaining work, in order

1. Resume the R2 decision. The owner was on the R2 billing-enrollment screen and asked how to stay within the free allowance. They have NOT confirmed enrollment. Do not accept that billing agreement for them. Explain that alerts do not cap charges; application quotas are not implemented yet. If enabled, create the private Standard bucket and verify a tiny disposable object's write/read/delete without public access.
2. Confirm the account's Workers plan and actual Time Travel retention in Cloudflare; update the documentation.
3. Prepare and verify the direct Cloudflare build/configuration. Inspect the Vite/Vinext output and its generated Wrangler config; do not assume it automatically uses `wrangler.production.jsonc`. Confirm the real Worker bindings point to production D1/R2. `.openai/hosting.json` is a Sites manifest, not proof of direct Cloudflare deployment.
4. Configure necessary server-side secrets privately: OpenAI, Resend, Roblox model-delivery key if used, and real Stripe keys/prices/webhook for real payments. Confirm canonical origin, email sender, verification policy, admin email, and any signing/configuration requirements from current code. Never reuse sandbox entitlements as proof of paid production access. Existing hosted secrets do not automatically transfer to the new Worker.
5. Test the intended production deployment before moving the public domain. Then perform the authorized domain cutover with a rollback path; verify the website's actual production bindings, health and clean data. Schedule private backups and preserve sandbox environments separately.

## New Mac setup and what does not transfer

Install Git and Node.js 24 LTS, then:

```sh
git clone https://github.com/nicholasardal-lang/SparkAI.git
cd SparkAI
npm ci
```

Authenticate GitHub and Cloudflare on the new computer. OAuth state is local; no credentials are in GitHub. Do not copy Windows `node_modules`, built output or cached runtime binaries to macOS. Inspect the current local-preview workflow before applying migrations; the README has historical sections describing old limits, model routing and one-migration setup. Current code, `.env.example`, migration files and the production runbook take precedence over those stale descriptions.

The Windows checkout was `C:\Users\Daniel\Documents\Codex\2026-09-28-spark-production`, branch `codex/production-storage`. Its local history includes private Sites setup commits. GitHub `main` received only the intended operational files; do not replace `main` wholesale with the Windows branch.

Windows Cloudflare login was saved under ignored `.sites-runtime/cloudflare-auth` using a workspace-local `XDG_CONFIG_HOME` because the Windows default config directory was blocked. On the Mac, sign in again; do not print or commit that OAuth file.

Private environment files, OAuth credentials, local `.wrangler/state`, SQL backups, and build/dependency caches are NOT in GitHub and will not appear after cloning. Transfer any private backup bundles securely outside Git if needed, or create a new production export after authentication. No secret should be requested in a chat message. Windows backup bundles are under ignored `.wrangler/backups/`; keep the `.sql`, `.schema.sql`, `.restore-schema.sql`, `.data.sql` and `.triggers.sql` files together.

## Product scope and working preferences

Spark helps beginner Roblox creators plan games, generate Luau/scripts and downloadable builds, and select model assets. Existing source also includes Asset Studio and bridge-related code; inspect and test before claiming integration is live. Avoid broad new Game Brain/Studio/feature work while completing production infrastructure. Do not claim models imported from a library are newly generated originals or that generated gameplay has been tested in Studio unless it actually has.

Keep updates concise and concrete. Work one step at a time, distinguish completed checks from planned work, and never declare production ready solely because code is pushed. Review current collaborator changes before implementation. Prior test evidence for this infrastructure change: core suite passed 110 checks, backup-format regression passed, remote recovery verified, nonempty restore refusal verified, and Git diff checks passed. Those checks do not prove launch readiness or replace macOS build verification.
