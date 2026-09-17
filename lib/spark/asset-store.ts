import type { DB } from "./core.ts";
import { validateAsset, validateScene, type LibraryAsset, type ScenePlan } from "./scenes.ts";

export const SCENE_JOB_LEASE_MS = 6 * 60 * 1000;
export const PROJECT_ASSET_LIMIT = 200;
export const PROJECT_SCENE_LIMIT = 100;

export class AssetStoreError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "AssetStoreError";
    this.status = status;
    this.code = code;
  }
}

export type SceneJob = {
  id: string;
  prompt: string;
  status: "queued" | "running" | "complete" | "failed";
  plan: ScenePlan | null;
  /** Immutable asset inputs for the latest attempt; completed exports use these. */
  assets: LibraryAsset[];
  error: string | null;
  created: number;
  updated: number;
  /** Fences completion writes from an expired or superseded planning attempt. */
  leaseToken: string | null;
};

type AssetRow = { id: string; spec_json: string; created: number };
type JobRow = {
  id: string;
  prompt: string;
  status: SceneJob["status"];
  plan_json: string | null;
  assets_json: string;
  error: string | null;
  created: number;
  updated: number;
  lease_token: string | null;
};

function invalid(message: string): never {
  throw new AssetStoreError(400, "INVALID_ASSET_INPUT", message);
}

function decodeAsset(row: AssetRow): LibraryAsset {
  return { ...JSON.parse(row.spec_json), id: row.id, created: row.created };
}

function decodeJob(row: JobRow): SceneJob {
  return {
    id: row.id, prompt: row.prompt, status: row.status,
    plan: row.plan_json ? JSON.parse(row.plan_json) : null,
    assets: JSON.parse(row.assets_json), error: row.error,
    created: row.created, updated: row.updated, leaseToken: row.lease_token,
  };
}

async function touchProject(db: DB, projectId: string): Promise<void> {
  await db.prepare("UPDATE projects SET updated=? WHERE id=?").bind(Date.now(), projectId).run();
}

export async function listAssets(db: DB, projectId: string): Promise<LibraryAsset[]> {
  const rows = await db.prepare("SELECT id,spec_json,created FROM project_assets WHERE project_id=? ORDER BY created,id")
    .bind(projectId).all();
  return (rows.results || []).map(decodeAsset);
}

export async function addAsset(db: DB, projectId: string, input: unknown): Promise<LibraryAsset> {
  let spec;
  try { spec = validateAsset(input); }
  catch (error) { invalid(error instanceof Error ? error.message : "Invalid asset."); }
  const id = crypto.randomUUID(), created = Date.now();
  // A single statement makes the project cap safe against simultaneous requests.
  const row = await db.prepare(`INSERT INTO project_assets(id,project_id,spec_json,created)
    SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM project_assets WHERE project_id=?)<?
    RETURNING id,spec_json,created`)
    .bind(id, projectId, JSON.stringify(spec), created, projectId, PROJECT_ASSET_LIMIT).first();
  if (!row) throw new AssetStoreError(409, "ASSET_LIMIT", `This project can hold ${PROJECT_ASSET_LIMIT} library assets.`);
  await touchProject(db, projectId);
  return decodeAsset(row);
}

export async function removeAsset(db: DB, projectId: string, id: string): Promise<void> {
  const row = await db.prepare("DELETE FROM project_assets WHERE project_id=? AND id=? RETURNING id")
    .bind(projectId, id).first();
  if (!row) throw new AssetStoreError(404, "ASSET_NOT_FOUND", "Asset not found.");
  await touchProject(db, projectId);
  // Scene attempts carry snapshots. Removing a library entry never deletes the
  // original Roblox asset and cannot invalidate a completed scene export.
}

async function expireLeases(db: DB, projectId: string): Promise<void> {
  const now = Date.now();
  await db.batch([
    db.prepare(`UPDATE projects SET updated=? WHERE id=? AND EXISTS (
      SELECT 1 FROM scene_jobs WHERE project_id=? AND status='running' AND updated<=?
    )`).bind(now, projectId, projectId, now - SCENE_JOB_LEASE_MS),
    db.prepare(`UPDATE scene_jobs SET status='failed',error=?,lease_token=NULL,updated=?
      WHERE project_id=? AND status='running' AND updated<=?`)
      .bind("The planning attempt timed out. No automatic retry was made; explicitly retry when ready.",
        now, projectId, now - SCENE_JOB_LEASE_MS),
  ]);
}

export async function listSceneJobs(db: DB, projectId: string): Promise<SceneJob[]> {
  await expireLeases(db, projectId);
  const rows = await db.prepare("SELECT * FROM scene_jobs WHERE project_id=? ORDER BY created DESC,id DESC")
    .bind(projectId).all();
  return (rows.results || []).map(decodeJob);
}

export async function getSceneJob(db: DB, projectId: string, id: string): Promise<SceneJob> {
  await expireLeases(db, projectId);
  const row = await db.prepare("SELECT * FROM scene_jobs WHERE project_id=? AND id=?")
    .bind(projectId, id).first();
  if (!row) throw new AssetStoreError(404, "SCENE_NOT_FOUND", "Scene job not found.");
  return decodeJob(row);
}

export async function createSceneJob(db: DB, projectId: string, input: { id: string; prompt: string }): Promise<SceneJob> {
  if (!input || typeof input.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.id)) {
    throw new AssetStoreError(400, "INVALID_SCENE_ID", "A valid request UUID is required.");
  }
  if (typeof input.prompt !== "string" || !input.prompt.trim() || input.prompt.length > 4000) {
    throw new AssetStoreError(400, "INVALID_SCENE_PROMPT", "Describe your scene in 1–4,000 characters.");
  }
  const now = Date.now();
  // The ID is a durable idempotency key. Identical retries return the saved job,
  // while reusing it for another project or prompt is rejected without disclosure.
  await db.prepare(`INSERT OR IGNORE INTO scene_jobs(id,project_id,prompt,status,assets_json,created,updated)
    SELECT ?,?,?,'queued','[]',?,? WHERE (SELECT COUNT(*) FROM scene_jobs WHERE project_id=?)<?`)
    .bind(input.id, projectId, input.prompt, now, now, projectId, PROJECT_SCENE_LIMIT).run();
  const row = await db.prepare("SELECT * FROM scene_jobs WHERE project_id=? AND id=?").bind(projectId, input.id).first();
  if (!row) {
    const count = await db.prepare("SELECT COUNT(*) AS total FROM scene_jobs WHERE project_id=?").bind(projectId).first();
    if (count.total >= PROJECT_SCENE_LIMIT) throw new AssetStoreError(409, "SCENE_LIMIT", `This project can hold ${PROJECT_SCENE_LIMIT} scene jobs.`);
    throw new AssetStoreError(409, "SCENE_ID_CONFLICT", "This request ID is already in use. Start a new scene job.");
  }
  if (row.prompt !== input.prompt) {
    throw new AssetStoreError(409, "SCENE_ID_CONFLICT", "This request ID is already in use. Start a new scene job.");
  }
  await touchProject(db, projectId);
  return decodeJob(row);
}

export async function claimSceneJob(db: DB, projectId: string, id: string): Promise<SceneJob> {
  // A stale lease is recorded as a failure, never silently re-submitted.
  const before = await db.prepare("SELECT * FROM scene_jobs WHERE project_id=? AND id=?")
    .bind(projectId, id).first();
  if (!before) throw new AssetStoreError(404, "SCENE_NOT_FOUND", "Scene job not found.");
  if (before.status === "running" && before.updated <= Date.now() - SCENE_JOB_LEASE_MS) {
    await expireLeases(db, projectId);
    throw new AssetStoreError(409, "SCENE_EXPIRED", "The previous attempt timed out. Review its status and explicitly retry.");
  }
  if (before.status === "complete") return decodeJob(before);
  const assets = await listAssets(db, projectId), token = crypto.randomUUID(), now = Date.now();
  const row = await db.prepare(`UPDATE scene_jobs
    SET status='running',error=NULL,plan_json=NULL,assets_json=?,lease_token=?,updated=?
    WHERE project_id=? AND id=? AND status IN ('queued','failed') RETURNING *`)
    .bind(JSON.stringify(assets), token, now, projectId, id).first();
  if (!row) throw new AssetStoreError(409, "SCENE_BUSY", "This scene is already being planned.");
  await touchProject(db, projectId);
  return decodeJob(row);
}

/** Include these statements in the same D1 batch as billing settlement. */
export async function prepareSceneCompletion(db: DB, projectId: string, id: string, plan: unknown, leaseToken: string) {
  const job = await getSceneJob(db, projectId, id);
  if (job.status !== "running" || !leaseToken || job.leaseToken !== leaseToken) {
    throw new AssetStoreError(409, "SCENE_LEASE_LOST", "This planning attempt is no longer active.");
  }
  let checked;
  try { checked = validateScene(plan, job.assets); }
  catch (error) {
    throw new AssetStoreError(400, "INVALID_SCENE", error instanceof Error ? error.message : "Invalid scene plan.");
  }
  const now = Date.now();
  return {
    plan: checked,
    statements: [
      // If ownership/lease disappeared after the read, force a NOT NULL failure
      // inside the batch. A zero-row UPDATE alone would otherwise charge credits
      // without persisting a scene. D1 rolls the entire batch back on this guard.
      db.prepare(`INSERT INTO scene_jobs(id,project_id,prompt,status,created,updated)
        SELECT ?,?,'',NULL,?,? WHERE NOT EXISTS (
          SELECT 1 FROM scene_jobs WHERE project_id=? AND id=? AND status='running' AND lease_token=? AND updated>?
        )`).bind(id, projectId, now, now, projectId, id, leaseToken, now - SCENE_JOB_LEASE_MS),
      db.prepare(`UPDATE scene_jobs SET status='complete',plan_json=?,error=NULL,lease_token=NULL,updated=?
        WHERE project_id=? AND id=? AND status='running' AND lease_token=?`)
        .bind(JSON.stringify(checked), now, projectId, id, leaseToken),
      db.prepare("UPDATE projects SET updated=? WHERE id=?").bind(now, projectId),
    ],
  };
}

export async function completeSceneJob(db: DB, projectId: string, id: string, plan: unknown, leaseToken: string): Promise<SceneJob> {
  const completion = await prepareSceneCompletion(db, projectId, id, plan, leaseToken);
  await db.batch(completion.statements);
  return getSceneJob(db, projectId, id);
}

export async function failSceneJob(db: DB, projectId: string, id: string, message: string, leaseToken: string): Promise<SceneJob> {
  const row = await db.prepare(`UPDATE scene_jobs SET status='failed',error=?,lease_token=NULL,updated=?
    WHERE project_id=? AND id=? AND status='running' AND lease_token=? RETURNING *`)
    .bind(String(message || "Scene planning failed.").slice(0, 500), Date.now(), projectId, id, leaseToken).first();
  if (!row) throw new AssetStoreError(409, "SCENE_LEASE_LOST", "This planning attempt is no longer active.");
  await touchProject(db, projectId);
  return decodeJob(row);
}
