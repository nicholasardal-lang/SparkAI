import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
import {
  addAsset, listAssets, removeAsset, createSceneJob, getSceneJob, listSceneJobs,
  claimSceneJob, completeSceneJob, prepareSceneCompletion, failSceneJob,
  SCENE_JOB_LEASE_MS, PROJECT_ASSET_LIMIT, PROJECT_SCENE_LIMIT,
} from "../lib/spark/asset-store.ts";

const sqlite = new DatabaseSync(":memory:");
sqlite.exec("PRAGMA foreign_keys=ON");
for (const file of readdirSync(new URL("../drizzle/", import.meta.url)).filter(name => name.endsWith(".sql")).sort()) {
  sqlite.exec(readFileSync(new URL("../drizzle/" + file, import.meta.url), "utf8"));
}
const DB = {
  prepare(sql) {
    return {
      args: [], bind(...args) { this.args = args; return this; },
      async first() { return sqlite.prepare(sql).get(...this.args) || null; },
      async all() { return { results: sqlite.prepare(sql).all(...this.args) }; },
      async run() { return sqlite.prepare(sql).run(...this.args); },
    };
  },
  async batch(statements) {
    sqlite.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      sqlite.exec("COMMIT");
      return results;
    } catch (error) {
      sqlite.exec("ROLLBACK");
      throw error;
    }
  },
};
for (const id of ["owner", "other"]) {
  sqlite.prepare("INSERT INTO users(id,email,password,salt) VALUES (?,?,?,?)").run(id, `${id}@spark.test`, "hash", "salt");
}
for (const [id, owner] of [["p1", "owner"], ["p2", "other"], ["caps", "owner"]]) {
  sqlite.prepare("INSERT INTO projects(id,user_id,name,description,updated) VALUES (?,?,?,?,?)").run(id, owner, id, "", 1);
}

const input = {
  name: "Weathered anvil", kind: "mesh", robloxId: "123456789", sourceUrl: "https://create.roblox.com/store/asset/123456789",
  license: "Owned by this project creator", tags: ["medieval", "metal"], size: [4, 3, 2],
  material: { material: "Metal", color: [90, 95, 100], pbr: { normalMap: "223456789", roughnessMap: "323456789" } },
};
const basePlan = {
  version: 1, name: "Blacksmith", style: "Weathered timber and warm iron",
  nodes: [{ id: "floor", name: "Floor", primitive: "Block", size: [10, 1, 10], position: [0, 0, 0], rotation: [0, 0, 0] }], missingAssets: [],
};
const create = (projectId = "p1", prompt = "Build a medieval blacksmith.") => createSceneJob(DB, projectId, { id: crypto.randomUUID(), prompt });
const code = expected => error => error.code === expected;

const asset = await addAsset(DB, "p1", input);
assert.match(asset.id, /^[0-9a-f-]{36}$/);
assert.ok(asset.created > 0);
assert.deepEqual(asset.material, input.material);
assert.equal((await listAssets(DB, "p1")).length, 1);
assert.deepEqual(await listAssets(DB, "p2"), []);
await assert.rejects(removeAsset(DB, "p2", asset.id), code("ASSET_NOT_FOUND"));
assert.equal((await listAssets(DB, "p1")).length, 1);
await assert.rejects(addAsset(DB, "p1", { ...input, robloxId: "not-an-id" }), code("INVALID_ASSET_INPUT"));
await assert.rejects(addAsset(DB, "p1", { ...input, license: "" }), code("INVALID_ASSET_INPUT"));
await assert.rejects(addAsset(DB, "p1", { ...input, sourceUrl: "javascript:alert(1)" }), code("INVALID_ASSET_INPUT"));
assert.equal((await listAssets(DB, "p1")).length, 1);

const queued = await create();
assert.equal(queued.status, "queued");
assert.equal(queued.plan, null);
assert.deepEqual(queued.assets, []);
assert.equal((await createSceneJob(DB, "p1", { id: queued.id, prompt: queued.prompt })).id, queued.id);
assert.equal((await listSceneJobs(DB, "p1")).length, 1);
await assert.rejects(createSceneJob(DB, "p2", { id: queued.id, prompt: queued.prompt }), code("SCENE_ID_CONFLICT"));
await assert.rejects(createSceneJob(DB, "p1", { id: queued.id, prompt: "Different prompt" }), code("SCENE_ID_CONFLICT"));
await assert.rejects(createSceneJob(DB, "p1", { id: "invalid", prompt: "Build" }), code("INVALID_SCENE_ID"));
await assert.rejects(createSceneJob(DB, "p1", { id: crypto.randomUUID(), prompt: " " }), code("INVALID_SCENE_PROMPT"));
await assert.rejects(createSceneJob(DB, "p1", { id: crypto.randomUUID(), prompt: "a".repeat(4001) }), code("INVALID_SCENE_PROMPT"));
await assert.rejects(getSceneJob(DB, "p2", queued.id), code("SCENE_NOT_FOUND"));
await assert.rejects(claimSceneJob(DB, "p2", queued.id), code("SCENE_NOT_FOUND"));
assert.deepEqual(await listSceneJobs(DB, "p2"), []);

const claims = await Promise.allSettled([claimSceneJob(DB, "p1", queued.id), claimSceneJob(DB, "p1", queued.id)]);
assert.equal(claims.filter(result => result.status === "fulfilled").length, 1);
assert.equal(claims.find(result => result.status === "rejected").reason.code, "SCENE_BUSY");
const claimed = claims.find(result => result.status === "fulfilled").value;
assert.equal(claimed.status, "running");
assert.ok(claimed.leaseToken);
assert.deepEqual(claimed.assets, [asset]);
await assert.rejects(completeSceneJob(DB, "p1", queued.id, basePlan, "wrong-token"), code("SCENE_LEASE_LOST"));
await assert.rejects(failSceneJob(DB, "p2", queued.id, "wrong owner", claimed.leaseToken), code("SCENE_LEASE_LOST"));
await assert.rejects(completeSceneJob(DB, "p1", queued.id, { ...basePlan, version: 999 }, claimed.leaseToken), code("INVALID_SCENE"));
assert.equal((await getSceneJob(DB, "p1", queued.id)).status, "running");

// A library deletion does not mutate the immutable asset inputs of a running job.
await removeAsset(DB, "p1", asset.id);
assert.deepEqual(await listAssets(DB, "p1"), []);
const meshPlan = { ...basePlan, nodes: [{ id: "anvil", name: "Anvil", assetId: asset.id, size: [4, 3, 2], position: [0, 2, 0], rotation: [0, 45, 0] }] };
const complete = await completeSceneJob(DB, "p1", queued.id, meshPlan, claimed.leaseToken);
assert.equal(complete.status, "complete");
assert.equal(complete.leaseToken, null);
assert.deepEqual(complete.plan, meshPlan);
assert.deepEqual(complete.assets, [asset]);
assert.deepEqual(await claimSceneJob(DB, "p1", complete.id), complete);
assert.equal((await getSceneJob(DB, "p1", complete.id)).assets[0].robloxId, input.robloxId);
await assert.rejects(failSceneJob(DB, "p1", complete.id, "late failure", claimed.leaseToken), code("SCENE_LEASE_LOST"));

const failing = await create();
const firstAttempt = await claimSceneJob(DB, "p1", failing.id);
await failSceneJob(DB, "p1", failing.id, "a".repeat(1000), firstAttempt.leaseToken);
assert.equal((await getSceneJob(DB, "p1", failing.id)).error.length, 500);
const newAsset = await addAsset(DB, "p1", { ...input, name: "Replacement anvil" });
const secondAttempt = await claimSceneJob(DB, "p1", failing.id);
assert.notEqual(secondAttempt.leaseToken, firstAttempt.leaseToken);
assert.equal(secondAttempt.error, null);
assert.deepEqual(secondAttempt.assets, [newAsset]);
await assert.rejects(completeSceneJob(DB, "p1", failing.id, basePlan, firstAttempt.leaseToken), code("SCENE_LEASE_LOST"));
await assert.rejects(failSceneJob(DB, "p1", failing.id, "stale", firstAttempt.leaseToken), code("SCENE_LEASE_LOST"));

// Completion and billing can share one atomic batch. If a lease is lost after
// preparation, even statements before the guard must roll back.
const prepared = await prepareSceneCompletion(DB, "p1", failing.id, basePlan, secondAttempt.leaseToken);
await failSceneJob(DB, "p1", failing.id, "cancelled attempt", secondAttempt.leaseToken);
await assert.rejects(DB.batch([
  DB.prepare("INSERT INTO limits(key,count) VALUES ('charge-probe',42)"),
  ...prepared.statements,
]), /NOT NULL constraint failed/);
assert.equal(sqlite.prepare("SELECT * FROM limits WHERE key='charge-probe'").get(), undefined);
assert.equal((await getSceneJob(DB, "p1", failing.id)).status, "failed");
const thirdAttempt = await claimSceneJob(DB, "p1", failing.id);
const validCompletion = await prepareSceneCompletion(DB, "p1", failing.id, basePlan, thirdAttempt.leaseToken);
await DB.batch([DB.prepare("INSERT INTO limits(key,count) VALUES ('successful-charge',7)"), ...validCompletion.statements]);
assert.equal(sqlite.prepare("SELECT count FROM limits WHERE key='successful-charge'").get().count, 7);
assert.equal((await getSceneJob(DB, "p1", failing.id)).status, "complete");

const expired = await create();
const expiredAttempt = await claimSceneJob(DB, "p1", expired.id);
sqlite.prepare("UPDATE scene_jobs SET updated=? WHERE id=?").run(Date.now() - SCENE_JOB_LEASE_MS - 1, expired.id);
await assert.rejects(claimSceneJob(DB, "p1", expired.id), code("SCENE_EXPIRED"));
const stale = await getSceneJob(DB, "p1", expired.id);
assert.equal(stale.status, "failed");
assert.match(stale.error, /No automatic retry/);
assert.equal(stale.leaseToken, null);
await assert.rejects(completeSceneJob(DB, "p1", expired.id, basePlan, expiredAttempt.leaseToken), code("SCENE_LEASE_LOST"));
const retryAfterExpiry = await claimSceneJob(DB, "p1", expired.id);
assert.equal(retryAfterExpiry.status, "running");
assert.notEqual(retryAfterExpiry.leaseToken, expiredAttempt.leaseToken);
sqlite.prepare("UPDATE scene_jobs SET updated=? WHERE id=?").run(Date.now() - SCENE_JOB_LEASE_MS - 1, expired.id);
assert.equal((await listSceneJobs(DB, "p1")).find(job => job.id === expired.id).status, "failed");

for (let i = 0; i < PROJECT_ASSET_LIMIT; i++) await addAsset(DB, "caps", input);
await assert.rejects(addAsset(DB, "caps", input), code("ASSET_LIMIT"));
assert.equal((await listAssets(DB, "caps")).length, PROJECT_ASSET_LIMIT);
let last;
for (let i = 0; i < PROJECT_SCENE_LIMIT; i++) last = await create("caps", `Scene ${i}`);
await assert.rejects(create("caps"), code("SCENE_LIMIT"));
assert.equal((await createSceneJob(DB, "caps", { id: last.id, prompt: last.prompt })).id, last.id);
assert.equal((await listSceneJobs(DB, "caps")).length, PROJECT_SCENE_LIMIT);
assert.ok(sqlite.prepare("SELECT updated FROM projects WHERE id='p1'").get().updated > 1);
assert.throws(() => sqlite.prepare("UPDATE scene_jobs SET status='invented' WHERE id=?").run(queued.id), /CHECK constraint failed/);

sqlite.prepare("DELETE FROM projects WHERE id='caps'").run();
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM project_assets WHERE project_id='caps'").get().n, 0);
assert.equal(sqlite.prepare("SELECT COUNT(*) AS n FROM scene_jobs WHERE project_id='caps'").get().n, 0);
assert.ok((await listSceneJobs(DB, "p1")).length > 0);
sqlite.close();
console.log("asset store: scoped library/jobs, snapshots, idempotency, limits, lease fencing and atomic completion passed");
