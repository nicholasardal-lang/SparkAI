import { DatabaseSync } from "node:sqlite";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";
const db = new DatabaseSync(":memory:");
for (const file of readdirSync(new URL("../drizzle/", import.meta.url)).filter(f=>f.endsWith(".sql")).sort())
  db.exec(readFileSync(new URL("../drizzle/"+file, import.meta.url), "utf8"));
const add=db.prepare("INSERT INTO users(id,email,password,salt,username) VALUES (?,?, 'fixture','fixture',?)");
add.run("one","one@example.test","SparkBuilder");
assert.throws(()=>add.run("two","two@example.test","sparkbuilder"), /USERNAME_TAKEN/);
db.prepare("UPDATE users SET username=? WHERE id='one'").run("NewBuilder");
assert.throws(()=>add.run("two","two@example.test","SPARKBUILDER"), /USERNAME_TAKEN/);
db.prepare("UPDATE users SET username=? WHERE id='one'").run("sparkbuilder");
db.prepare("DELETE FROM users WHERE id='one'").run();
assert.throws(()=>add.run("two","two@example.test","SparkBuilder"), /USERNAME_TAKEN/);
add.run("two","two@example.test","AnotherBuilder");
console.log("Username claims: case variants, rename, original-owner reuse, deletion, and distinct names passed.");
