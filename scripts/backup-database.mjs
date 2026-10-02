import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { combineD1Backup, splitD1Schema } from "./backup-format.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const database = process.env.SPARK_D1_DATABASE || "spark-production";
const config = process.env.SPARK_WRANGLER_CONFIG || resolve(root, "wrangler.production.jsonc");
const stamp = new Date().toISOString().replace(/[.:]/g, "-");
const output = resolve(process.argv[2] || resolve(root, `.wrangler/backups/spark-${stamp}.sql`));
mkdirSync(dirname(output), { recursive: true });
const cli = resolve(root, "node_modules/wrangler/bin/wrangler.js");
// Wrangler prints a signed download URL. Keep that temporary credential out of logs.
const safeLog = text => (text || "").replace(/https:\/\/\S*X-Amz-\S*/g, "[private export download URL omitted]");
for (const [flag, target] of [["--no-data", `${output}.schema.sql`], ["--no-schema", `${output}.data.sql`]]) {
  const result = spawnSync(process.execPath, [cli, "d1", "export", database, "--config", config, "--remote", flag, "--skip-confirmation", "--output", target], { encoding: "utf8", cwd: root });
  process.stdout.write(safeLog(result.stdout));
  process.stderr.write(safeLog(result.stderr));
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
const schema = readFileSync(`${output}.schema.sql`, "utf8");
const data = readFileSync(`${output}.data.sql`, "utf8");
const parts = splitD1Schema(schema);
writeFileSync(`${output}.restore-schema.sql`, parts.schema, { mode: 0o600 });
writeFileSync(`${output}.triggers.sql`, parts.triggers, { mode: 0o600 });
writeFileSync(output, combineD1Backup(schema, data), { mode: 0o600 });
console.log(`Database export written to ${output}`);
console.log("Keep all companion SQL files together. Do not run migrations between schema and data exports.");
