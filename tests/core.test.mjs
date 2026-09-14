import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { LEGAL_VERSION } from "../lib/spark/legal.ts";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { handle, providerError, callOpenAI } from "../lib/spark/core.ts";
const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
for (const file of readdirSync(new URL("../drizzle/", import.meta.url)).filter(name => name.endsWith(".sql")).sort()) {
  sqlite.exec(readFileSync(new URL("../drizzle/" + file, import.meta.url), "utf8"));
}
const DB = {
  prepare(sql) {
    return {
      args: [],
      bind(...args) {
        this.args = args;
        return this;
      },
      async first() {
        return sqlite.prepare(sql).get(...this.args) || null;
      },
      async all() {
        return { results: sqlite.prepare(sql).all(...this.args) };
      },
      async run() {
        return sqlite.prepare(sql).run(...this.args);
      },
    };
  },
  async batch(stmts) {
    sqlite.exec("BEGIN");
    try {
      const result = [];
      for (const s of stmts) result.push(await s.run());
      sqlite.exec("COMMIT");
      return result;
    } catch (e) {
      sqlite.exec("ROLLBACK");
      throw e;
    }
  },
};
let env = { DB };
let calls = 0;
const fake = async (url, options) => {
  calls++;
  const payload = JSON.parse(options.body);
  assert.equal(payload.model, "gpt-5-mini");
  assert.ok(payload.input.some((m) => m.content.includes("checkpoint")));
  assert.ok(payload.instructions.includes("Roblox Studio"));
  assert.equal(payload.store, false);
  return Response.json({
    output_text: 'Test fixture response: ```luau\nprint("checkpoint")\n```',
  });
};
async function request(
  path,
  method = "GET",
  body,
  cookie = "",
  fetcher = fake,
) {
  const response = await handle(
    new Request("https://spark.test/api/" + path, {
      method,
      headers: {
        Origin: "https://spark.test",
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: body ? JSON.stringify(body) : undefined,
    }),
    env,
    fetcher,
  );
  return {
    status: response.status,
    data: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
let checks = 0;
function check(value, message) {
  assert.ok(value, message);
  checks++;
  console.log("PASS", message);
}
check(
  (await request("projects")).status === 401,
  "Unauthenticated API access rejected",
);
check(
  (await request("auth/signup", "POST", { email: "bad", password: "short" }))
    .status === 400,
  "Signup validation",
);
check((await request("auth/signup", "POST", { email: "missing@example.test", password: "test-password-missing" })).data.code === "LEGAL_ACCEPTANCE_REQUIRED", "Signup rejects missing agreement");
check((await request("auth/signup", "POST", { email: "stale@example.test", password: "test-password-stale", acceptedLegal: true, legalVersion: "old" })).data.code === "LEGAL_ACCEPTANCE_REQUIRED", "Signup rejects stale agreement");
const a = await request("auth/signup", "POST", {
  acceptedLegal: true, legalVersion: LEGAL_VERSION,
  email: "one@example.test",
  password: "test-password-one",
});
const b = await request("auth/signup", "POST", {
  acceptedLegal: true, legalVersion: LEGAL_VERSION,
  email: "two@example.test",
  password: "test-password-two",
});
check(
  a.status === 200 && b.status === 200,
  "Two independent accounts can sign up",
);
const consent = sqlite.prepare("SELECT legal_version,legal_accepted_at FROM users WHERE email=?").get("one@example.test");
check(consent.legal_version === LEGAL_VERSION && consent.legal_accepted_at > 0, "Acceptance version and timestamp persist");
check((await request("projects", "GET", undefined, a.cookie)).status === 402, "Unpaid account cannot read workspace API");
check((await request("projects", "POST", { name: "Bypass", workspace_enabled: 1 }, a.cookie)).status === 402, "Client cannot grant itself workspace access");
env.STRIPE_SECRET_KEY = "sk_test_fixture";
let stripeBody = "";
const stripeCheckout = await request("billing/checkout", "POST", { kind: "plan", planId: "starter", period: "yearly" }, a.cookie, async (url, options) => {
  assert.equal(url, "https://api.stripe.com/v1/checkout/sessions");
  stripeBody = options.body;
  return Response.json({ url: "https://checkout.stripe.test/session" });
});
check(stripeCheckout.data.url === "https://checkout.stripe.test/session" && new URLSearchParams(stripeBody).get("line_items[0][price]") === "price_1UFeJpA98x23KT8UuMBI33Xa", "Checkout uses the server-owned annual Starter Price ID");
env.STRIPE_WEBHOOK_SECRET = "whsec_fixture";
const webhookPayload = JSON.stringify({ id: "evt_pack_fixture", type: "checkout.session.completed", data: { object: { id: "cs_fixture", mode: "payment", payment_status: "paid", payment_intent: "pi_fixture", metadata: { user_id: b.data.user.id, credits: "600", pack_name: "Small" } } } });
const webhookTimestamp = Math.floor(Date.now() / 1000);
const webhookSignature = createHmac("sha256", env.STRIPE_WEBHOOK_SECRET).update(`${webhookTimestamp}.${webhookPayload}`).digest("hex");
const webhookRequest = () => handle(new Request("https://spark.test/api/stripe/webhook", { method: "POST", headers: { "Content-Type": "application/json", "stripe-signature": `t=${webhookTimestamp},v1=${webhookSignature}` }, body: webhookPayload }), env, fake);
check((await webhookRequest()).status === 200 && sqlite.prepare("SELECT workspace_enabled FROM users WHERE id=?").get(b.data.user.id).workspace_enabled === 1, "Verified Stripe payment unlocks the account");
await webhookRequest();
check(sqlite.prepare("SELECT COUNT(*) AS count FROM credit_ledger WHERE user_id=?").get(b.data.user.id).count === 1, "Duplicate Stripe events do not duplicate credits");
// Only this isolated test database provisions access for the existing workspace suite.
sqlite.prepare("UPDATE users SET workspace_enabled=1").run();
check(
  (await request("projects", "GET", undefined, a.cookie)).data.projects
    .length === 0,
  "New account contains no samples",
);
check(
  (
    await request("auth/login", "POST", {
      email: "one@example.test",
      password: "wrong-password",
    })
  ).status === 401,
  "Invalid password rejected",
);
check(
  (
    await request("auth/login", "POST", {
      email: "one@example.test",
      password: "test-password-one",
    })
  ).status === 200,
  "Email/password login",
);
const created = await request(
  "projects",
  "POST",
  { name: "Obby", description: "checkpoint game" },
  a.cookie,
);
const id = created.data.id;
check(created.status === 201, "Create project");
for (const [method, suffix, payload] of [
  ["GET", "", null],
  ["PATCH", "", { name: "hacked" }],
  ["DELETE", "", {}],
  [
    "POST",
    "/messages",
    { content: "checkpoint", requestId: crypto.randomUUID() },
  ],
])
  check(
    (await request("projects/" + id + suffix, method, payload, b.cookie))
      .status === 404,
    `Ownership enforced for ${method} ${suffix || "project"}`,
  );
check(
  (
    await request(
      "projects/" + id,
      "PATCH",
      { name: "Renamed", description: "checkpoint game" },
      a.cookie,
    )
  ).status === 200,
  "Rename project",
);
const rid = crypto.randomUUID();
const message = { content: "Build a checkpoint", requestId: rid };
const missing = await request(
  "projects/" + id + "/messages",
  "POST",
  message,
  a.cookie,
);
check(
  missing.data.code === "AI_SETUP_REQUIRED",
  "Missing credentials reported explicitly",
);
check(calls === 0, "Missing key makes no provider request");
let reloaded = await request("projects/" + id, "GET", undefined, a.cookie);
check(
  reloaded.data.messages.length === 1 &&
    reloaded.data.messages[0].content === message.content,
  "Conversation persists after missing-key failure",
);
await request("projects/" + id + "/messages", "POST", message, a.cookie);
check(
  (await request("projects/" + id, "GET", undefined, a.cookie)).data.messages
    .length === 1,
  "Retry does not duplicate user message",
);
env = {
  DB,
  OPENAI_API_KEY: "test-only-not-a-real-key",
  DAILY_MESSAGE_LIMIT: "2",
};
check(
  (await request("projects/" + id + "/messages", "POST", message, a.cookie))
    .status === 200,
  "Configured provider response saved (mocked provider)",
);
reloaded = await request("projects/" + id, "GET", undefined, a.cookie);
check(
  reloaded.data.messages.length === 2 &&
    reloaded.data.messages[1].role === "assistant",
  "Saved assistant response reloads",
);
const before = calls;
await request("projects/" + id + "/messages", "POST", message, a.cookie);
check(calls === before, "Completed idempotency key prevents repeat billing");
check(
  (
    await request(
      "projects/" + id + "/messages",
      "POST",
      { content: "checkpoint ".repeat(1000), requestId: crypto.randomUUID() },
      a.cookie,
    )
  ).status === 400,
  "Message size limit",
);
let providerCalls = 0;
const rate = async () => {
  providerCalls++;
  return Response.json({ error: { message: "busy" } }, { status: 429 });
};
const limited = await request(
  "projects/" + id + "/messages",
  "POST",
  { content: "another checkpoint", requestId: crypto.randomUUID() },
  a.cookie,
  rate,
);
check(
  limited.data.code === "RATE_LIMIT" && providerCalls === 3,
  "Temporary rate limit gets exactly two bounded retries",
);
check(
  (
    await request(
      "projects/" + id + "/messages",
      "POST",
      { content: "checkpoint again", requestId: crypto.randomUUID() },
      a.cookie,
    )
  ).data.code === "DAILY_LIMIT",
  "Per-user daily usage enforced",
);
check(
  providerError(401, {}).code === "INVALID_CREDENTIALS",
  "Invalid credentials classification",
);
check(
  providerError(400, { error: { message: "Your credit balance is too low" } })
    .code === "NO_CREDITS",
  "Missing credits classification",
);
check(
  providerError(503, {}).code === "PROVIDER_UNAVAILABLE",
  "Temporary server error classification",
);
const foreign = await handle(
  new Request("https://spark.test/api/projects", {
    method: "POST",
    headers: {
      Origin: "https://evil.test",
      "Content-Type": "application/json",
      Cookie: a.cookie,
    },
    body: JSON.stringify({ name: "wrong" }),
  }),
  env,
);
check(foreign.status === 403, "Cross-origin mutation rejected");
check(
  (await request("projects/" + id, "DELETE", {}, a.cookie)).status === 200,
  "Delete project",
);
check(
  sqlite.prepare("SELECT count(*) n FROM messages").get().n === 0,
  "Project deletion cascades to messages",
);
await request("auth/logout", "POST", {}, a.cookie);
check(
  (await request("projects", "GET", undefined, a.cookie)).status === 401,
  "Logout invalidates server session",
);
let quotaCalls = 0;
await assert.rejects(() => callOpenAI({ OPENAI_API_KEY: "fixture" }, [], {}, async () => {
  quotaCalls++;
  return Response.json({ error: { type: "insufficient_quota", message: "Quota exceeded" } }, { status: 429 });
}), (error) => error.code === "NO_CREDITS");
check(quotaCalls === 1, "Credit exhaustion is not retried");
const partial = await callOpenAI({ OPENAI_API_KEY: "fixture" }, [], {}, async () => Response.json({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output: [{ content: [{ type: "output_text", text: "```luau\nlocal x = 1" }] }] }));
check(partial.includes("\n```\n\n*Response reached"), "Truncated code is closed and labelled incomplete");
await assert.rejects(() => callOpenAI({ OPENAI_API_KEY: "fixture" }, [], {}, async () => Response.json({ status: "incomplete", output: [] })), (error) => error.code === "INCOMPLETE_RESPONSE");
check(true, "Empty incomplete replies return actionable errors");
console.log(
  `${checks} checks passed. Provider responses were test fixtures, never live OpenAI.`,
);
