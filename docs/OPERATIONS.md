# Spark operations

Spark exposes two small operational endpoints for the hosted deployment:

- `GET /api/health` checks that the worker and D1 database are reachable and reports whether the OpenAI and Stripe integrations are configured. Point an uptime monitor at this URL and alert on a non-2xx response or `ok:false`.
- `GET /api/admin/metrics` returns owner-only totals for users, active subscriptions, requests, errors, and outstanding credits. Set the `ADMIN_EMAIL` hosting secret to the owner account before using it.

## Backups

The Spark database is Cloudflare D1. Enable D1 Time Travel in the Cloudflare dashboard for point-in-time recovery, and keep a periodic export outside the deployment account. From an authenticated Wrangler environment, run:

```text
node scripts/backup-database.mjs
```

Keep several dated exports in a separate private location and periodically restore one to a non-production database to verify that backups are usable. Never commit an export, API key, webhook secret, or customer data to GitHub.

## Abuse protection

Authentication attempts are throttled per IP and email. AI requests are throttled per IP and account, have a daily account limit, enforce a maximum prompt size, and reserve credits before calling OpenAI. Failed provider calls refund the reservation; Stripe webhook events are signature-checked and idempotent.
