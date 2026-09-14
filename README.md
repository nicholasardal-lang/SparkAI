# Spark

Spark is a working web app for planning Roblox games, generating Luau scripts, and debugging through conversation. It is independent from Roblox, Anthropic, and OpenAI. Roblox Studio integration is coming soon; the app cannot install, test, or publish scripts.

## Open the hosted app

Spark is publicly available at https://spark-roblox-creative-workspace.puriux.chatgpt.site. It has its own email/password accounts. Test accounts and the local test database are not deployed. See [Working on Spark](docs/WORKING-ON-SPARK.md) for using the shared GitHub project on Mac and PC.

Click **Get started**, create an account with an email address and a password of at least 12 characters, and accept the Terms and Privacy drafts. New accounts go to plan selection. Stripe sandbox checkout is implemented in source but requires the hosted Stripe secrets and webhook registration before it is deployed. OpenAI billing and a hosted API key are also needed for AI requests. See [Payment preview](docs/PAYMENTS-PREVIEW.md) for the remaining integration work.

## Enable OpenAI safely

1. Create or open an OpenAI API account at https://platform.openai.com/. API usage requires billing credits; a ChatGPT subscription is separate from API usage.
2. Create an API key there. Never paste it into a chat conversation, a browser-facing app field, or a source file that will be shared.
3. In your hosting service's server-side environment settings, set **OPENAI_API_KEY** as a **secret**. For Sites, use its runtime environment-variable controls with the secret flag, then redeploy the saved version to apply it. If those controls are unavailable in your interface, use the local setup below; do not put the key in a conversation as a workaround.
4. Leave **OPENAI_MODEL** at `gpt-5-mini`, or change it to a model your OpenAI account supports.
5. Reload Spark and retry a saved message. No provider is used as a fallback.

The chosen model is `gpt-5-mini`, called through OpenAI's Responses API. Check current OpenAI model pricing before enabling billing. Spark sets `store: false` and keeps conversation history in its own database. Conversation context is included in each request, which contributes to cost. Local development does not require paid hosting. Hosting plan limits and fees depend on the provider; no subscription or API credit purchase was made during this build.

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
| `OPENAI_MODEL`         | `gpt-5-mini`        | Backend-only configurable model                                  |
| `DAILY_MESSAGE_LIMIT`  | `30`                | Per-account AI requests per UTC day; bounded between 1 and 1,000 |
| `AI_MAX_OUTPUT_TOKENS` | `2048`              | Per-response output limit; bounded between 256 and 4,096         |

Messages are limited to 8,000 characters and request bodies to 24 KB. Context includes up to the latest 30 messages within 30,000 characters, plus project details. Each initial AI attempt consumes one daily allowance, including failed provider calls; up to two automatic retries for explicit temporary rate limits or provider 5xx errors belong to that attempt. A saved request can have at most three user-initiated AI attempts. Requests that lack an API key consume no AI allowance. The quota is per user, not a global billing cap: set provider-side spending limits before broad public access.

Invalid credentials, insufficient credits, model/configuration errors, temporary rate limits, network errors, and provider/server failures have separate messages. Only explicit 429/5xx provider responses receive automatic bounded retries. Network timeouts are not automatically retried because the provider may already have processed the request. A database-backed per-project lock prevents concurrent sends; a request ID avoids saving or charging twice for a completed submission. The lock expires after 90 seconds if a process stops. No system can guarantee exactly-once provider billing after an ambiguous network failure; review billing before manually repeating such requests.

## Security and scope

Authentication uses salted PBKDF2-SHA256 password hashes (100,000 iterations, compatible with the Worker Web Crypto limit), random session tokens stored only as SHA-256 hashes, and HttpOnly/SameSite cookies that are Secure over HTTPS. Sessions last seven days and logout removes the server session. Server-side ownership checks protect every project and conversation operation. All SQL uses bound parameters. Mutations check their Origin and require JSON. Auth attempts are limited by email and IP. Markdown renders without raw HTML or external images.

This first version does not include email verification, password recovery, a Roblox Studio plugin, code execution, or publication to Roblox. Do not rely on an email address being verified. Data is stored in the deployment's database; saved conversation content is sent to OpenAI only when configured and a response is requested. No sample projects are inserted into real accounts.

## Checks

```sh
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
