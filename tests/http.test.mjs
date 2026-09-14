import assert from "node:assert/strict";
const base = "http://localhost:5173";
async function call(path, method = "GET", body, cookie = "") {
  const r = await fetch(base + "/api/" + path, {
    method,
    headers: {
      Origin: base,
      "Content-Type": "application/json",
      Cookie: cookie,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
const email = "http-" + Date.now() + "@example.test";
const a = await call("auth/signup", "POST", {
  email,
  password: "test-password-http",
});
assert.equal(a.status, 200);
const login = await call("auth/login", "POST", {
  email,
  password: "test-password-http",
});
assert.equal(login.status, 200);
const b = await call("auth/signup", "POST", {
  email: "second-" + email,
  password: "test-password-http",
});
assert.equal(b.status, 200);
const p = await call(
  "projects",
  "POST",
  { name: "HTTP test", description: "Disposable local project" },
  a.cookie,
);
assert.equal(p.status, 201);
const path = "projects/" + p.data.id;
assert.equal((await call(path, "GET", undefined, b.cookie)).status, 404);
assert.equal(
  (await call(path, "PATCH", { name: "Renamed test" }, a.cookie)).status,
  200,
);
const msg = {
  content: "Help me plan an obby.",
  requestId: crypto.randomUUID(),
};
const sent = await call(path + "/messages", "POST", msg, a.cookie);
assert.equal(sent.data.code, "AI_SETUP_REQUIRED");
assert.equal(
  (await call(path, "GET", undefined, a.cookie)).data.messages[0].content,
  msg.content,
);
await call(path + "/messages", "POST", msg, a.cookie);
assert.equal(
  (await call(path, "GET", undefined, a.cookie)).data.messages.length,
  1,
);
const protectedPage = await fetch(base + "/dashboard", { redirect: "manual" });
assert.ok([302, 303, 307].includes(protectedPage.status));
assert.ok(protectedPage.headers.get("location").includes("login"));
assert.equal((await call(path, "DELETE", {}, a.cookie)).status, 200);
await call("auth/logout", "POST", {}, a.cookie);
assert.equal((await call("projects", "GET", undefined, a.cookie)).status, 401);
console.log(
  "PASS: Real local Worker + D1 HTTP flow: signup, login, create, rename, ownership, missing key, persisted message, duplicate prevention, protected page redirect, delete, logout.",
);
