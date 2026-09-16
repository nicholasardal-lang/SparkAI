import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import { handle, hash } from "../lib/spark/core.ts";
import { LEGAL_VERSION } from "../lib/spark/legal.ts";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
for (const file of readdirSync(new URL("../drizzle/", import.meta.url)).filter(f => f.endsWith(".sql")).sort())
  sqlite.exec(readFileSync(new URL("../drizzle/" + file, import.meta.url), "utf8"));
let failBatch = false;
const DB = {
  prepare(sql) {
    return {
      args: [], bind(...args) { this.args = args; return this; },
      async first() { return sqlite.prepare(sql).get(...this.args) || null; },
      async run() { return { meta: { changes: sqlite.prepare(sql).run(...this.args).changes } }; },
    };
  },
  async batch(statements) {
    sqlite.exec("BEGIN");
    try {
      const result = [];
      for (const statement of statements) {
        result.push(await statement.run());
        if (failBatch) throw new Error("Simulated transaction failure");
      }
      sqlite.exec("COMMIT"); return result;
    } catch (error) { sqlite.exec("ROLLBACK"); throw error; }
  },
};
const env = { DB, REQUIRE_EMAIL_VERIFICATION: "true", RESEND_API_KEY: "test-only", EMAIL_FROM: "Spark <test@example.test>", APP_ORIGIN: "https://canonical.test" };
const mail = [];
let failDelivery = false;
async function fetcher(url, options) {
  assert.equal(url, "https://api.resend.com/emails");
  if (failDelivery) return new Response(null, { status: 503 });
  mail.push(JSON.parse(options.body));
  return Response.json({ id: "fixture" });
}
async function request(path, body, cookie = "", overrides = {}, origin = "https://spark.test") {
  const response = await handle(new Request("https://spark.test/api/" + path, {
    method: "POST", headers: { Origin: origin, "Content-Type": "application/json", Cookie: cookie }, body: JSON.stringify(body),
  }), { ...env, ...overrides }, fetcher);
  return { status: response.status, data: await response.json(), cookie: response.headers.get("set-cookie")?.split(";")[0] };
}
const email = "builder@example.test";
const signup = await request("auth/signup", { email, username: "builder", password: "original-password", acceptedLegal: true, legalVersion: LEGAL_VERSION });
assert.equal(signup.status, 200);
const verification = mail.at(-1).html.match(/token=([^"\s]+)/)[1];
mail.length = 0;
for (const overrides of [{ RESEND_API_KEY: "" }, { EMAIL_FROM: "" }, { APP_ORIGIN: "" }, { APP_ORIGIN: "javascript:bad" }]) {
  sqlite.exec("DELETE FROM limits");
  assert.equal((await request("auth/forgot-password", { email }, "", overrides)).status, 503);
}
sqlite.exec("DELETE FROM limits");
const known = await request("auth/forgot-password", { email: "BUILDER@example.test" });
const unknown = await request("auth/forgot-password", { email: "absent@example.test" });
assert.equal(known.status, 200);
assert.deepEqual(known.data, unknown.data);
assert.equal(mail.length, 1);
const reset = mail.at(-1).html.match(/#token=([^"\s]+)/)[1];
assert.ok(mail.at(-1).html.includes("https://canonical.test/reset-password#"));
assert.ok(sqlite.prepare("SELECT 1 FROM auth_tokens WHERE token_hash=?").get(await hash(reset)));
assert.equal((await request("auth/verify-email", { token: reset })).status, 400);
assert.equal((await request("auth/reset-password", { token: verification, password: "replacement-password" })).status, 400);
assert.equal((await request("auth/reset-password", { token: reset, password: "short" })).status, 400);
assert.equal(sqlite.prepare("SELECT used_at FROM auth_tokens WHERE token_hash=?").get(await hash(reset)).used_at, null);
assert.equal((await request("auth/reset-password", { token: reset, password: "replacement-password" }, "", {}, "https://evil.test")).status, 403);
failBatch = true;
assert.equal((await request("auth/reset-password", { token: reset, password: "replacement-password" })).status, 500);
failBatch = false;
assert.equal(sqlite.prepare("SELECT used_at FROM auth_tokens WHERE token_hash=?").get(await hash(reset)).used_at, null);
assert.equal((await request("auth/login", { email, password: "original-password" })).status, 200);
const success = await request("auth/reset-password", { token: reset, password: "replacement-password" }, signup.cookie);
assert.equal(success.status, 200);
assert.equal(success.cookie, "spark_session=");
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 0);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM auth_tokens WHERE used_at IS NULL").get().n, 0);
assert.equal((await request("auth/reset-password", { token: reset, password: "attacker-password" })).status, 400);
assert.equal((await request("auth/login", { email, password: "original-password" })).status, 401);
const login = await request("auth/login", { email, password: "replacement-password" });
assert.equal(login.status, 200);
assert.ok(sqlite.prepare("SELECT email_verified_at FROM users").get().email_verified_at);
assert.equal(sqlite.prepare("SELECT email_verification_required FROM users").get().email_verification_required, 0);
sqlite.exec("DELETE FROM limits");
await request("auth/forgot-password", { email });
const expired = mail.at(-1).html.match(/#token=([^"\s]+)/)[1];
sqlite.exec("UPDATE auth_tokens SET expires=0");
assert.equal((await request("auth/reset-password", { token: expired, password: "attacker-password" })).status, 400);
await request("auth/forgot-password", { email });
const old = mail.at(-1).html.match(/#token=([^"\s]+)/)[1];
assert.equal((await request("security", { action: "password", currentPassword: "replacement-password", newPassword: "changed-password" }, login.cookie)).status, 200);
assert.equal((await request("auth/reset-password", { token: old, password: "attacker-password" })).status, 400);
failDelivery = true;
const failed = await request("auth/forgot-password", { email });
assert.deepEqual(failed.data, unknown.data);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM auth_tokens WHERE used_at IS NULL").get().n, 0);
assert.equal((await request("auth/forgot-password", { email })).status, 429);
console.log("PASS: recovery, invalid-password retry, rollback, expiry, replay, purpose isolation, session and token revocation, existing verification behavior, origin protection, private responses, delivery failure cleanup, and rate limits. Emails are mocked.");
