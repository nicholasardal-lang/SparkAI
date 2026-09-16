# Spark

Spark is a working web app for planning Roblox games, generating Luau scripts, and debugging through conversation. It is independent from Roblox, Anthropic, and OpenAI. Roblox Studio integration is coming soon; the app cannot install, test, or publish scripts.

## Open the hosted app

Spark is publicly available at https://spark-roblox-creative-workspace.puriux.chatgpt.site. It has its own email/password accounts. Test accounts and the local test database are not deployed. See [Working on Spark](docs/WORKING-ON-SPARK.md) for using the shared GitHub project on Mac and PC.

Click **Get started**, create an account with a unique username, an email address, and a password of at least 12 characters, and accept the Terms and Privacy drafts. New accounts go to plan selection. Email verification is enabled for new accounts when the hosted Resend settings are configured. Stripe sandbox checkout, subscription management, cancellation, credit grants, and webhook provisioning are implemented in source but require the hosted Stripe secrets and webhook registration. OpenAI billing and a hosted API key are also needed for AI requests. See [Payment preview](docs/PAYMENTS-PREVIEW.md) for the remaining integration work.

## Enable OpenAI safely

1. Create or open an OpenAI API account at https://platform.openai.com/. API usage requires billing credits; a ChatGPT subscription is separate from API usage.
2. Create an API key there. Never paste it into a chat conversation, a browser-facing app field, or a source file that will be shared.
3. In your hosting service's server-side environment settings, set **OPENAI_API_KEY** as a **secret**. For Sites, use its runtime environment-variable controls with the secret flag, then redeploy the saved version to apply it. If those controls are unavailable in your interface, use the local setup below; do not put the key in a conversation as a workaround.
4. Leave **OPENAI_MODEL** unset or `auto` for automatic routing between `gpt-5-mini`, `gpt-5.6-terra`, and `gpt-6-astra`. A supported model ID pins the server to that model.
5. Reload Spark and retry a saved message. No provider is used as a fallback.

Spark uses OpenAI's Responses API with low reasoning effort. Its initial rules route short planning to GPT-5 mini, ordinary coding to GPT-5.6 Terra, and complex systems, extensive code, or difficult debugging to GPT-6 Astra. This is a deterministic heuristic, not a learned classifier. The server quotes the selected model and estimated/max credits before sending; actual token usage determines the charge using model-specific weights. Rates are in `lib/spark/models.ts` and require review when provider pricing changes. Spark sets `store: false` and includes only answered conversation history plus the current prompt. All provider attempts and response-body reads share a 60-second deadline, within the 90-second project lock and 120-second credit reservation. Timeouts and ambiguous network errors are not automatically retried. Logs include model, duration, status, and provider request ID, never prompts or secrets.

## Run on your computer

Install Node.js 24 LTS from https://nodejs.org/ and open a terminal in the extracted Spark source folder. The following commands use the npm command included with a normal Node installation:

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_plain_the_captain.sql
npm run dev
```

Open the local address printed in the terminal (normally http://localhost:5173). Run the migration command once for a new local database. Local accounts and conversations live in the ignored `.wrangler/state` folder. Keep that folder if you want to retain your local data. The production database is separate and receives migrations during Sites publishing.

To configure local AI, copy `.env.example` to `.env`, then privately edit the blank `OPENAI_API_KEY` value on your own computer and restart the server. The Cloudflare development runtime reads `.env`; it is ignored by Git. Never prefix this key with `NEXT_PUBLIC_` or `VITE_`. Do not share your `.env` file. For a standalone built Worker preview, use `npm start`; Wrangler prints its local address.

## Cost and request limits

| Server setting         | Default             | Behavior                                                         |
| ---------------------- | ------------------- | ---------------------------------------------------------------- |
| `OPENAI_API_KEY`       | Empty               | AI disabled; accounts, projects, and messages still work         |
| `OPENAI_MODEL`         | `auto`              | Automatic routing, or a supported model ID to pin all requests    |
| `DAILY_MESSAGE_LIMIT`  | `30`                | Per-account AI requests per UTC day; bounded between 1 and 1,000 |
| `AI_MAX_OUTPUT_TOKENS` | `4096`              | Per-response output limit including reasoning; bounded between 256 and 4,096 |
| `RESEND_API_KEY`       | Empty               | Server-side key for verification and password recovery email    |
| `EMAIL_FROM`           | Empty               | Verified sender address used by the email provider              |
| `APP_ORIGIN`           | Request origin      | Public origin used in links sent by email                       |
| `ADMIN_EMAIL`          | Empty               | Owner account allowed to read `/api/admin/metrics`               |

Messages are limited to 8,000 characters and request bodies to 24 KB. Context includes up to the latest 30 messages within 30,000 characters, plus project details. Each initial AI attempt consumes one daily allowance, including failed provider calls; up to two automatic retries for explicit temporary rate limits or provider 5xx errors belong to that attempt. A saved request can have at most three user-initiated AI attempts. Requests that lack an API key consume no AI allowance. The quota is per user, not a global billing cap: set provider-side spending limits before broad public access.

Invalid credentials, insufficient credits, model/configuration errors, temporary rate limits, network errors, and provider/server failures have separate messages. Only explicit 429/5xx provider responses receive automatic bounded retries. Network timeouts are not automatically retried because the provider may already have processed the request. A database-backed per-project lock prevents concurrent sends; a request ID avoids saving or charging twice for a completed submission. The lock expires after 90 seconds if a process stops. No system can guarantee exactly-once provider billing after an ambiguous network failure; review billing before manually repeating such requests.

## Security and scope

Authentication uses salted PBKDF2-SHA256 password hashes (100,000 iterations, compatible with the Worker Web Crypto limit), random session tokens stored only as SHA-256 hashes, and HttpOnly/SameSite cookies that are Secure over HTTPS. Sessions last seven days and logout removes the server session. Server-side ownership checks protect every project and conversation operation. All SQL uses bound parameters. Mutations check their Origin and require JSON. Auth attempts are limited by email and IP. Markdown renders without raw HTML or external images.

Password recovery and email verification use short-lived, single-use, hashed tokens. Configure `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_ORIGIN` in server-side hosting settings for delivery; without an email provider, new accounts remain pending verification until delivery is configured. Subscription entitlements are extended only by paid Stripe invoices, cancellation and failed-renewal events are handled, and credits are ledgered and reserved transactionally. A Roblox Studio plugin, code execution, and publication to Roblox are not included. Data is stored in the deployment's database; saved conversation content is sent to OpenAI only when configured and a response is requested. No sample projects are inserted into real accounts.

## Checks

Password reset uses the existing `0006_auth_tokens.sql` migration; no additional migration is needed. Apply outstanding migrations in order before running this version. Set `RESEND_API_KEY`, `EMAIL_FROM` (a verified sender), and `APP_ORIGIN` (the canonical HTTPS origin; HTTP localhost is allowed for development) to enable reset emails. Missing configuration returns a temporary-unavailability error. Reset links expire after one hour. Requests return the same response for registered and unknown addresses, and are rate limited. Failed delivery is logged without addresses or tokens. Resetting a password revokes all sessions and outstanding account tokens atomically, while retaining the existing email-verification behavior. Previously issued query-string links still work; new links use fragments to keep tokens out of server request logs.

```sh
node tests/email-auth.test.mjs
node tests/core.test.mjs
npx tsc --noEmit
npm run build
# With the development server running:
node tests/http.test.mjs
```

The core suite uses an isolated SQLite database and a clearly marked mock provider; test replies never enter the real app. It checks account validation, login/logout, empty accounts, project CRUD, cross-account ownership, message persistence, idempotency, request sizes, daily limits, bounded retries, provider error classification, and cross-origin rejection. The HTTP suite exercises the actual local Worker and D1 storage. Browser checks cover signup, project creation, missing-AI messaging and reload, and responsive navigation. Live OpenAI was not tested because no API key was supplied. Generated Roblox scripts have not been executed or tested in Roblox Studio.

## Project layout

- `app/page.tsx`: landing page
- `app/auth-form.tsx`, `app/login`, `app/signup`: account forms
- `app/dashboard`: saved projects and project management
- `app/projects/[id]`: chat, Markdown, copied code, and script panel
- `app/api/[...path]/route.ts`: server API entrypoint
- `lib/spark/core.ts`: authentication, ownership, storage, quotas, OpenAI requests
- `db/schema.ts`, `drizzle/`: database definitions and migrations
- `app/globals.css`: Spark design and responsive styling
- `.openai/hosting.json`: Sites identity and database binding, never secrets

Stack: React, TypeScript, Vinext/Vite, a Cloudflare-compatible Worker, and D1 SQLite. The backend is included in this source, not a separate unimplemented service.
# Manual Roblox exports and temporary email policy

## Beginner generation quality

Build requests use a strict Responses API JSON schema, server-side artifact validation, and app-rendered download cards. Plain JSON and JSON-fenced models in older messages are recovered into the same cards without changing saved history. Runnable script downloads use Roblox files by default; source is collapsed under View code. Broad build prompts route to at least Terra, while planning remains lightweight. The prompt asks for compact usable builds, reachable beginner geometry, and honest limits for static models.

Generation configuration is versioned in `lib/spark/generation.ts`. Run `node --test tests/generation.test.mjs tests/artifacts.test.mjs tests/core.test.mjs` for regression checks. With an API key set privately, `node scripts/evaluate-generation.mjs` runs three paid representative prompts and writes an ignored report to `work/generation-evaluation.json`. Review the report for clarity, usable files and behavior claims; import representative files into Studio before declaring gameplay validated. Compare reports when changing models or prompts. This is an evaluation loop, not automatic learning from user conversations.

Email verification is paused by default (`REQUIRE_EMAIL_VERIFICATION=false`). Existing and new accounts can log in without delivery; addresses are not marked verified. Paid access and credit enforcement remain enabled. Re-enable verification explicitly only after email delivery is configured. Password recovery shows an unavailable message when email delivery is not configured.

The chat immediately displays a submitted message and clears the composer, then shows a working state. Saved requests retain retry protection.

Generated Luau blocks can be downloaded as source files or imported as `.rbxmx` Script/LocalScript/ModuleScript objects from the Files panel. Runnable imported scripts start disabled for review. Model replies use validated `spark-model` JSON to create `.rbxmx` models with 1–50 anchored, axis-aligned Block/Ball/Cylinder/Wedge parts. This is part-based construction, not mesh generation or rigging. Invalid or incomplete model responses cannot be downloaded. Files are reconstructed from saved conversations; no automatic Studio installation or execution occurs. Import and game behavior still need manual Studio testing.
