import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import { LEGAL_VERSION } from "../lib/spark/legal.ts";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { handle, providerError, callOpenAI } from "../lib/spark/core.ts";
import { balance, syncSubscription, reserve, settle, monthAt } from "../lib/spark/billing.ts";
import { selectModel, modelCredits } from "../lib/spark/models.ts";
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
let env = { DB, REQUIRE_EMAIL_VERIFICATION: "true" };
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
  username: "builder_one",
  password: "test-password-one",
});
const b = await request("auth/signup", "POST", {
  acceptedLegal: true, legalVersion: LEGAL_VERSION,
  email: "two@example.test",
  username: "builder_two",
  password: "test-password-two",
});
check(
  a.status === 200 && b.status === 200,
  "Two independent accounts can sign up",
);
const consent = sqlite.prepare("SELECT legal_version,legal_accepted_at FROM users WHERE email=?").get("one@example.test");
check(consent.legal_version === LEGAL_VERSION && consent.legal_accepted_at > 0, "Acceptance version and timestamp persist");
const unverifiedWorkspace = await request("projects", "GET", undefined, a.cookie);
check(unverifiedWorkspace.status === 403 && unverifiedWorkspace.data.code === "EMAIL_NOT_VERIFIED", "Unverified account cannot read workspace API");
env.REQUIRE_EMAIL_VERIFICATION = "false";
const noVerifySignup = await request("auth/signup", "POST", {email:"noverify@example.test",username:"noverify_builder",password:"test-password-noverify",acceptedLegal:true,legalVersion:LEGAL_VERSION});
check(noVerifySignup.status===200 && !noVerifySignup.data.needsVerification && !noVerifySignup.data.verificationSent, "Signup succeeds without sending a verification email while paused");
check((await request("projects", "GET", undefined, a.cookie)).status === 402, "Paused verification allows existing users through to paid-access checks");
const noVerifyLogin = await request("auth/login", "POST", {email:"one@example.test",password:"test-password-one"});
check(noVerifyLogin.status === 200 && !noVerifyLogin.data.needsVerification, "Login does not require email delivery while verification is paused");
check(sqlite.prepare("SELECT email_verified_at FROM users WHERE id=?").get(a.data.user.id).email_verified_at === null, "Pausing verification does not falsely verify an email");
env.REQUIRE_EMAIL_VERIFICATION = "true";
sqlite.prepare("UPDATE users SET email_verified_at=? WHERE email IN (?,?)").run(Date.now(), "one@example.test", "two@example.test");
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
check(new URLSearchParams(stripeBody).get("success_url").includes("{CHECKOUT_SESSION_ID}"), "Checkout return carries its Stripe session reference");
const paidSession={id:"cs_fixture",status:"complete",payment_status:"paid",mode:"payment",payment_intent:"pi_fixture",client_reference_id:b.data.user.id,metadata:{user_id:b.data.user.id},success_url:"https://spark.test/upgrade?checkout=success",line_items:{data:[{price:{id:"price_1UFeMQA98x23KT8UQdK4S8l2"},quantity:1}]}};
const sessionFetch=(patch={})=>async()=>Response.json({...paidSession,...patch});
check((await request("billing/confirm","POST",{sessionId:"cs_fixture"})).status===401,"Payment confirmation requires sign-in");
check((await request("billing/confirm","POST",{sessionId:"cs_fixture"},a.cookie,sessionFetch())).status===409,"Another user's checkout cannot unlock access");
check(!(await request("billing/confirm","POST",{sessionId:"cs_fixture"},b.cookie,sessionFetch({payment_status:"unpaid"}))).data.confirmed,"Unpaid Stripe session is not confirmed");
check(!(await request("billing/confirm","POST",{sessionId:"cs_fixture"},b.cookie,sessionFetch({status:"open"}))).data.confirmed,"Incomplete checkout is not confirmed");
check((await request("billing/confirm","POST",{sessionId:"cs_fixture"},b.cookie,sessionFetch({success_url:"https://another.test/upgrade"}))).status===409,"Checkout from another site is rejected");
check((await request("billing/confirm","POST",{sessionId:"cs_fixture"},b.cookie,sessionFetch())).data.confirmed,"Verified paid checkout unlocks without waiting for a webhook");
await request("billing/confirm","POST",{sessionId:"cs_fixture"},b.cookie,sessionFetch());
check(sqlite.prepare("SELECT COUNT(*) AS count FROM credit_ledger WHERE user_id=?").get(b.data.user.id).count===1,"Return-page confirmation and webhook grant credits only once");
check(!(await request("billing/confirm","POST",{},b.cookie,()=>{throw Error("Must not list sessions on hosted sites")})).data.confirmed,"Hosted confirmation without session never scans Stripe customers");
const subOwner=noVerifySignup.data.user.id;
const subscriptionFetch=async url=>Response.json(url.includes("checkout/sessions/")?{...paidSession,mode:"subscription",subscription:"sub_confirm",client_reference_id:subOwner,metadata:{user_id:subOwner}}:{id:"sub_confirm",customer:"cus_confirm",metadata:{user_id:subOwner},status:"active",latest_invoice:{status:"paid"},items:{data:[{price:{id:"price_1UFeGEA98x23KT8UKb0v9mj9"},current_period_start:Math.floor(Date.now()/1000)-60,current_period_end:Math.floor(Date.now()/1000)+86400*30}]}});
check((await request("billing/confirm","POST",{sessionId:"cs_fixture"},noVerifySignup.cookie,subscriptionFetch)).data.confirmed,"Subscription confirmation verifies paid invoice and period with Stripe");
await request("billing/confirm","POST",{sessionId:"cs_fixture"},noVerifySignup.cookie,subscriptionFetch);
check((await balance(env,subOwner,subscriptionFetch)).credits===1200,"Repeated subscription confirmation grants one monthly allowance");
// Only this isolated test database provisions access for the existing workspace suite.
sqlite.prepare("UPDATE users SET workspace_enabled=1").run();
sqlite.prepare("INSERT INTO credit_buckets(id,user_id,remaining,source) VALUES ('fixture',?,1000,'pack')").run(a.data.user.id);
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
const optionRequest={content:'Make a dog',requestId:crypto.randomUUID()};
const optionsFetcher=async url=>Response.json(url.includes('thumbnails')?{data:[]}:{creatorStoreAssets:Array.from({length:8},(_,i)=>({asset:{id:123+i,name:'Model '+i,assetTypeId:10,scriptCount:0},creatorStoreProduct:{purchasable:true,purchasePrice:{quantity:{significand:0}}}}))});
check((await request(`projects/${id}/model-options`,'POST',optionRequest,a.cookie,optionsFetcher)).status===200,'Model request returns saved chat options without an AI call');
check(JSON.parse(sqlite.prepare('SELECT content FROM messages WHERE id=?').get(optionRequest.requestId+':models').content.split('\n').slice(1).join('\n')).models.length===6,'Model suggestions include six options when available');
check((await request(`projects/${id}/model-options`,'POST',optionRequest,a.cookie,()=>{throw Error('Duplicate must not search')})).status===200,'Retrying model request does not duplicate the conversation');
check((await request(`projects/${id}/model-options`,'PATCH',{messageId:optionRequest.requestId+':models',assetId:'999'},a.cookie)).status===400,'Model selection rejects an asset not offered');
check((await request(`projects/${id}/model-options`,'PATCH',{messageId:optionRequest.requestId+':models',assetId:'123'},b.cookie)).status===404,'Model selection enforces project ownership');
check((await request(`projects/${id}/model-options`,'PATCH',{messageId:optionRequest.requestId+':models',assetId:'123'},a.cookie)).status===200,'User can choose a suggested model');
check(sqlite.prepare('SELECT content FROM messages WHERE id=?').get(optionRequest.requestId+':models').content.includes('"selectedId":"123"'),'Model selection persists on reload');
sqlite.prepare('DELETE FROM messages WHERE project_id=?').run(id);
check((await request(`projects/${id}/creator-store?q=dog`,"GET",undefined,b.cookie)).status===404,"Creator Store search enforces project ownership");
check((await request(`projects/${id}/creator-store?q=`,"GET",undefined,a.cookie)).status===400,"Creator Store search rejects empty queries");
check((await request(`projects/${id}/creator-store?q=dog`,"GET",undefined,a.cookie,async()=>Response.json({creatorStoreAssets:[]}))).status===200,"Signed-in project owner can search without AI configuration");
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
const message = { content: "Explain checkpoint behavior", requestId: rid };
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
env.DAILY_MESSAGE_LIMIT = "30";
const quote = await request("projects/" + id + "/estimate", "POST", {content:"debug checkpoint"}, a.cookie);
check(quote.data.model === "gpt-5.6-terra", "Estimate selects Terra for focused debugging");
const historyResult = await request("projects/" + id + "/messages", "POST",
  { content: "debug checkpoint", requestId: crypto.randomUUID(), model:quote.data.model,maxCredits:quote.data.maxCredits }, a.cookie,
  async (url, options) => {
    const payload = JSON.parse(options.body);
    assert.ok(payload.input.some(m => m.content.includes("Test fixture response")));
    assert.ok(!payload.input.some(m => m.content.includes("another checkpoint") || m.content.includes("checkpoint again")));
    return Response.json({ output_text: "Only answered history was included." });
  });
check(historyResult.status === 200, "Failed and unanswered prompts do not contaminate new requests");
let unauthorizedCalls=0;
const rejectedQuote=await request("projects/"+id+"/messages","POST",{content:"Design a secure trading system",requestId:crypto.randomUUID(),model:"gpt-5-mini",maxCredits:1},a.cookie,async()=>{unauthorizedCalls++;return Response.json({output_text:"unexpected"});});
check(rejectedQuote.data.code==="QUOTE_CHANGED" && unauthorizedCalls===0,"Client cannot force a cheaper model or bypass the credit quote");
const afterRejectedQuote=await request("projects/"+id,"GET",undefined,a.cookie);
check(!afterRejectedQuote.data.messages.some(m=>m.content==="Design a secure trading system"),"Unaccepted quotes do not create unanswered messages");
check(selectModel("Give me five obby ideas").model==="gpt-5-mini","Short planning routes to mini");
check(selectModel("Plan a five-stage obby. No code yet.").model==="gpt-5-mini","Asking for no code does not trigger a coding model");
check(selectModel("Audit this trading system for a race condition").model==="gpt-6-astra","Complex debugging routes to Astra even in a short prompt");
check(selectModel("x".repeat(4500)).model==="gpt-5-mini","Length alone does not force an expensive model");
check(modelCredits("gpt-6-astra",1000,1000)>modelCredits("gpt-5.6-terra",1000,1000) && modelCredits("gpt-5.6-terra",1000,1000)>modelCredits("gpt-5-mini",1000,1000),"Credits account for the selected model's cost");
// Real SQLite integration: compaction is quoted, survives reload, and is atomic
// with the answer/credit settlement. Provider calls are deterministic fixtures.
const historyStart=Date.now()-1000000;
for(let i=0;i<18;i++) {
 const uid=crypto.randomUUID(),stamp=historyStart+i*2;
 const text=`Decision ${i}: use mobile controls and CoinsStore_v2. `+'Keep the user decisions and names unchanged. '.repeat(150);
 sqlite.prepare("INSERT INTO requests (id,user_id,project_id,content,state,created,attempts) VALUES (?,?,?,?,'complete',?,1)").run(uid,a.data.user.id,id,text,stamp);
 sqlite.prepare("INSERT INTO messages (id,project_id,role,content,created) VALUES (?,?,'user',?,?)").run(uid,id,text,stamp);
 sqlite.prepare("INSERT INTO messages (id,project_id,role,content,created) VALUES (?,?,'assistant',?,?)").run(crypto.randomUUID(),id,'local coins = workspace.Coins\n'.repeat(150),stamp+1);
}
const storedCount=sqlite.prepare('SELECT count(*) n FROM messages WHERE project_id=?').get(id).n;
const creditsBefore=await balance(env,a.data.user.id);
const memoryBefore=sqlite.prepare('SELECT * FROM conversation_memory WHERE project_id=?').get(id);
const memoryPrompt='What is a checkpoint?';
const memoryQuote=await request(`projects/${id}/estimate`,'POST',{content:memoryPrompt},a.cookie);
check(memoryQuote.status===200,'Long history can be quoted without a summary API call');
let summaries=0;
const summaryResponse=(payload)=>{const source=JSON.parse(payload.input[0].content).find(s=>s.role==='user'&&s.content.includes('CoinsStore_v2'));return Response.json({status:'completed',output_text:JSON.stringify({selectedIds:[source.id]}),usage:{input_tokens:1000,output_tokens:100}});};
const failedMemory=await request(`projects/${id}/messages`,'POST',{content:memoryPrompt,requestId:crypto.randomUUID(),model:memoryQuote.data.model,maxCredits:memoryQuote.data.maxCredits},a.cookie,async(_,opts)=>{
 const payload=JSON.parse(opts.body);
 if(payload.instructions.startsWith('Select the IDs')) {summaries++;return summaryResponse(payload);}
 throw new TypeError('fixture network failure after summary');
});
check(summaries>0&&failedMemory.data.code==='NETWORK_ERROR','Long history is summarized before the main response');
check((await balance(env,a.data.user.id)).credits===creditsBefore.credits,'Failed main response refunds summary and answer reservation');
check(JSON.stringify(sqlite.prepare('SELECT * FROM conversation_memory WHERE project_id=?').get(id))===JSON.stringify(memoryBefore),'Failed response does not advance durable summary cursor');
const memorySuccess=await request(`projects/${id}/messages`,'POST',{content:memoryPrompt,requestId:crypto.randomUUID(),model:memoryQuote.data.model,maxCredits:memoryQuote.data.maxCredits},a.cookie,async(_,opts)=>{
 const payload=JSON.parse(opts.body);
 if(payload.instructions.startsWith('Select the IDs')) return summaryResponse(payload);
 assert.ok(payload.input.some(m=>m.content.includes('CoinsStore_v2')));
 assert.equal(payload.model,memoryQuote.data.model);assert.equal(payload.reasoning.effort,'low');
 return Response.json({status:'completed',output_text:'Checkpoint explanation with remembered mobile controls.',usage:{input_tokens:1000,output_tokens:100}});
});
check(memorySuccess.status===200&&memorySuccess.data.credits<=memoryQuote.data.maxCredits,'Compaction and answer settle within the accepted quote');
const durable=sqlite.prepare('SELECT * FROM conversation_memory WHERE project_id=?').get(id);
check(durable.through_id&&durable.summary.includes('CoinsStore_v2'),'Summary and cursor persist after successful completion');
check(sqlite.prepare('SELECT count(*) n FROM messages WHERE project_id=?').get(id).n===storedCount+3,'Compaction keeps all original messages');
const reQuote=await request(`projects/${id}/estimate`,'POST',{content:'What is a variable?'},a.cookie);
check(reQuote.status===200&&reQuote.data.model==='gpt-5-mini','Reloaded summary supports a new economical topic');
check(
  (await request("projects/" + id, "DELETE", {}, a.cookie)).status === 200,
  "Delete project",
);
check(
  sqlite.prepare("SELECT count(*) n FROM messages").get().n === 0,
  "Project deletion cascades to messages",
);
check(!sqlite.prepare('SELECT * FROM conversation_memory WHERE project_id=?').get(id),'Project deletion cascades to conversation memory');
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
let partialCharged = false;
await assert.rejects(() => callOpenAI({ OPENAI_API_KEY: "fixture" }, [], {}, async () => Response.json({ status: "incomplete", incomplete_details: { reason: "max_output_tokens" }, output_text: "partial code" }), () => { partialCharged = true; }), error => error.code === "INCOMPLETE_RESPONSE");
check(!partialCharged, "Truncated replies are rejected before billing or displaying partial code");
await assert.rejects(() => callOpenAI({ OPENAI_API_KEY: "fixture" }, [], {}, async () => Response.json({ status: "incomplete", output: [] })), (error) => error.code === "INCOMPLETE_RESPONSE");
check(true, "Empty incomplete replies return actionable errors");
let networkCalls = 0;
await assert.rejects(() => callOpenAI({}, [], {}, async () => {
  networkCalls++;
  throw new TypeError("connection reset");
}), error => error.code === "NETWORK_ERROR");
check(networkCalls === 1, "Ambiguous network failures are never automatically retried");
let bodyCalls = 0;
await assert.rejects(() => callOpenAI({}, [], {}, async () => {
  bodyCalls++;
  return { json: async () => { throw new DOMException("deadline", "TimeoutError"); } };
}), error => error.code === "AI_TIMEOUT" && error.status === 504);
check(bodyCalls === 1, "Response-body timeouts are classified and never automatically retried");
const savedTimeout = AbortSignal.timeout;
let deadlineCalls = 0, deadlineSignals = [];
try {
  AbortSignal.timeout = milliseconds => {
    assert.equal(milliseconds, 60000);
    deadlineCalls++;
    return savedTimeout(milliseconds);
  };
  const reply = await callOpenAI({}, [], {}, async (url, options) => {
    deadlineSignals.push(options.signal);
    const payload = JSON.parse(options.body);
    assert.equal(payload.model, "gpt-5-mini");
    assert.equal(payload.reasoning.effort, "low");
    assert.equal(payload.max_output_tokens, 2048);
    return deadlineSignals.length === 1 ? Response.json({}, { status: 503 }) : Response.json({ output_text: "Recovered" });
  });
  assert.equal(reply, "Recovered");
} finally { AbortSignal.timeout = savedTimeout; }
check(deadlineCalls === 1 && deadlineSignals[0] === deadlineSignals[1], "Provider retries share one deadline within both request locks");
console.log(
  `${checks} checks passed. Provider responses were test fixtures, never live OpenAI.`,
);
const owner=b.data.user.id;
const start=Date.now()-86400000,end=monthAt(start,1);
let subscription={id:'sub_fixture',customer:'cus_fixture',metadata:{user_id:owner},status:'active',cancel_at_period_end:false,latest_invoice:{status:'paid'},items:{data:[{current_period_start:Math.floor(start/1000),current_period_end:Math.floor(end/1000),price:{id:'price_1UFeGEA98x23KT8UKb0v9mj9'}}]}};
const billingEnv={DB,STRIPE_SECRET_KEY:'fixture'};
const billingFetch=async()=>Response.json(subscription);
await syncSubscription(billingEnv,owner,subscription.id,billingFetch);
let state=await balance(billingEnv,owner,billingFetch);
check(state.active&&state.credits===1800,'Paid subscription grants credits alongside purchased credits');
check((await balance(billingEnv,owner,billingFetch)).credits===1800,'Reload does not grant credits twice');
subscription.cancel_at_period_end=true;
await syncSubscription(billingEnv,owner,subscription.id,billingFetch);
check((await balance(billingEnv,owner,billingFetch)).active,'Cancellation at period end preserves paid access');
const paidUntil=state.paidUntil;
subscription.status='past_due';subscription.latest_invoice.status='open';
subscription.items.data[0].current_period_start=Math.floor(end/1000);
subscription.items.data[0].current_period_end=Math.floor(monthAt(start,2)/1000);
await syncSubscription(billingEnv,owner,subscription.id,billingFetch);
check((await balance(billingEnv,owner,billingFetch)).paidUntil===paidUntil,'Failed renewal does not extend paid access');
const reservation=await reserve(DB,owner,'spend_fixture',20);
await assert.rejects(()=>reserve(DB,owner,'second_request',1));
await settle(DB,owner,'spend_fixture',reservation,3);
check((await balance(billingEnv,owner,billingFetch)).credits===1797,'Only actual usage charged after reservation');
const failed=await reserve(DB,owner,'failure_fixture',20);
await settle(DB,owner,'failure_fixture',failed,0);
check((await balance(billingEnv,owner,billingFetch)).credits===1797,'Failed AI request refunds reserved credits');
await reserve(DB,owner,'interrupted_fixture',20);
sqlite.prepare('UPDATE credit_locks SET expires=0 WHERE user_id=?').run(owner);
const recovered=await reserve(DB,owner,'recovered_fixture',20);
await settle(DB,owner,'recovered_fixture',recovered,0);
check((await balance(billingEnv,owner,billingFetch)).credits===1797,'Interrupted requests recover reserved credits after timeout');
sqlite.prepare('UPDATE billing_accounts SET paid_until=?,updated_at=? WHERE user_id=?').run(Date.now()-1,Date.now(),owner);
state=await balance(billingEnv,owner,billingFetch);
check(!state.active&&state.credits===600,'Expiry removes plan access and preserves purchased credits');
sqlite.prepare('UPDATE credit_buckets SET remaining=0 WHERE user_id=?').run(owner);
await assert.rejects(()=>reserve(DB,owner,'empty_fixture',1));
check((await balance(billingEnv,owner,billingFetch)).credits===0,'Exhausted credits cannot be spent');
const pictures = new Map();
env.BUCKET = {
  async put(key, bytes) { pictures.set(key, bytes.slice()); },
  async get(key) { return pictures.has(key) ? {body:pictures.get(key)} : null; },
  async delete(key) { pictures.delete(key); },
};
async function pictureRequest(method, bytes, cookie=b.cookie, origin="https://spark.test") {
  return handle(new Request("https://spark.test/api/profile/avatar", {method,headers:{Origin:origin,Cookie:cookie,"Content-Type":"image/png"},...(bytes?{body:bytes}:{})}),env,fake);
}
const png=Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1cAAAAASUVORK5CYII=","base64");
check((await pictureRequest("PUT",png,"")).status===401,"Avatar uploads require a signed-in account");
check((await pictureRequest("PUT",png,b.cookie,"https://evil.test")).status===403,"Avatar upload rejects a foreign origin");
check((await pictureRequest("PUT",new TextEncoder().encode("<svg/>"))).status===400,"Avatar upload rejects non-PNG content");
check((await pictureRequest("PUT",new Uint8Array(300001))).status===413,"Avatar upload enforces a bounded size");
check((await pictureRequest("PUT",png)).status===200,"Avatar upload saves a valid picture");
const picture=await pictureRequest("GET");
check(picture.status===200 && Buffer.from(await picture.arrayBuffer()).equals(png),"Uploaded avatar persists and reloads");
const otherLogin=await request("auth/login","POST",{email:"one@example.test",password:"test-password-one"});
check((await pictureRequest("GET",undefined,otherLogin.cookie)).status===404,"Other accounts cannot read another user's avatar");
check((await pictureRequest("DELETE")).status===200 && (await pictureRequest("GET")).status===404,"Removing a picture restores the default avatar");
console.log(`${checks} total checks passed.`);
