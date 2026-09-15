import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const database = process.env.SPARK_D1_DATABASE || "spark";
const stamp = new Date().toISOString().slice(0, 10);
const output = resolve(process.argv[2] || `backups/spark-${stamp}.sql`);
mkdirSync(dirname(output), { recursive: true });
const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["wrangler", "d1", "export", database, "--remote", "--output", output], { stdio: "inherit" });
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status || 1);
console.log(`Database export written to ${output}`);
