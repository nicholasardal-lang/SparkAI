import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const [database, configArgument, backupArgument] = process.argv.slice(2);
if (!database || !configArgument || !backupArgument) throw new Error('Usage: node scripts/restore-database.mjs EMPTY_TEST_DATABASE CONFIG BACKUP.sql');
const root = fileURLToPath(new URL('../', import.meta.url));
const config = resolve(configArgument);
const backup = resolve(backupArgument);
// This tool is for isolated drills, never an in-place production overwrite.
if (database === 'spark-production' || readFileSync(config, 'utf8').includes('599871d7-f879-4712-85f2-25f2a407f082')) {
  throw new Error('Production restore refused. Use the documented authorized incident procedure.');
}
const files = [`${backup}.restore-schema.sql`, `${backup}.data.sql`, `${backup}.triggers.sql`];
for (const file of files) if (!existsSync(file)) throw new Error('Backup companions missing. Generate a complete backup before restoring.');
const cli = resolve(root, 'node_modules/wrangler/bin/wrangler.js');
function run(extra) {
  const result = spawnSync(process.execPath, [cli,'d1','execute',database,'--config',config,'--remote',...extra], {cwd:root,encoding:'utf8'});
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`D1 recovery command failed: ${(result.stderr || result.stdout).slice(-1500)}`);
  return result.stdout;
}
const existing = JSON.parse(run(['--command',"SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%';",'--json']));
if (existing.some(x => x.results?.length)) throw new Error('Recovery target is not empty. Existing data was not changed.');
for (const file of files) {
  if (readFileSync(file,'utf8').trim()) run(['--file',file,'--yes','--json']);
}
const check = JSON.parse(run(['--command','PRAGMA foreign_key_check;','--json']));
if (check.some(x => !x.success || x.results?.length)) throw new Error('Restored data failed foreign-key validation. Keep the target isolated.');
console.log('Recovery import completed: schema, data, triggers, and foreign keys verified. Check application records before using it.');
