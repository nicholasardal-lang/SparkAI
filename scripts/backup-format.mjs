// Schema comes from a trusted D1 schema-only export. Never parse customer data
// as SQL structure: conversation text can contain semicolons and SQL-looking lines.
export function splitD1Schema(schema) {
  const triggers = [];
  const tablesAndIndexes = schema.replace(
    /^CREATE\s+(?:TEMP(?:ORARY)?\s+)?TRIGGER\b[\s\S]*?^END\s*;[ \t]*(?:\r?\n|$)/gim,
    trigger => { triggers.push(trigger.trim()); return ""; },
  );
  if (/^CREATE\s+(?:TEMP(?:ORARY)?\s+)?TRIGGER\b/im.test(tablesAndIndexes)) {
    throw new Error("Unrecognized trigger definition: retain raw exports and review before restoring.");
  }
  // All referenced tables must exist before inserts. Recreate triggers after
  // restored rows so username-claim triggers do not duplicate exported claims.
  return { schema: tablesAndIndexes.trim(), triggers: triggers.join("\n") };
}

export function combineD1Backup(schema, data) {
  const parts = splitD1Schema(schema);
  return `PRAGMA defer_foreign_keys=TRUE;\n${parts.schema}\n${data.trim()}\n${parts.triggers}\n`;
}
