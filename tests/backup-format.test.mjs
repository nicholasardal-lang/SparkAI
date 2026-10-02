import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { combineD1Backup } from '../scripts/backup-format.mjs';

const schema = `CREATE TABLE messages(id TEXT PRIMARY KEY, project_id TEXT REFERENCES projects(id), content TEXT);
CREATE TABLE projects(id TEXT PRIMARY KEY, user_id TEXT REFERENCES users(id));
CREATE TABLE users(id TEXT PRIMARY KEY, username TEXT);
CREATE TABLE claims(username TEXT PRIMARY KEY, user_id TEXT);
CREATE TRIGGER claim_username BEFORE INSERT ON users
BEGIN
  INSERT INTO claims VALUES(NEW.username,NEW.id);
END;
`;
const content = "A user's conversation;\nCREATE TABLE bogus(x TEXT);\nCREATE TRIGGER bogus\nBEGIN\nSELECT 1;\nEND;";
const quote = value => `'${value.replace(/'/g, "''")}'`;
const data = `PRAGMA defer_foreign_keys=TRUE;
INSERT INTO messages VALUES('m','p',${quote(content)});
INSERT INTO projects VALUES('p','u');
INSERT INTO claims VALUES('unique_name','u');
INSERT INTO users VALUES('u','unique_name');`;
const db = new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON; BEGIN');
db.exec(combineD1Backup(schema, data));
db.exec('COMMIT');
assert.equal(db.prepare('SELECT content FROM messages WHERE id=?').get('m').content, content);
assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
assert.equal(db.prepare('SELECT count(*) n FROM claims').get().n, 1);
assert.throws(() => db.prepare('INSERT INTO users VALUES(?,?)').run('u2','unique_name'), /UNIQUE/);
assert.equal(db.prepare('SELECT count(*) n FROM users').get().n, 1);
assert.throws(() => combineD1Backup('CREATE TRIGGER incomplete BEFORE INSERT ON users BEGIN', ''), /Unrecognized trigger/);
db.close();
console.log('Backup replay preserves related rows, conversation text, and username triggers.');
