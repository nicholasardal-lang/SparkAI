// Keep script/gameplay requests in chat. A high-fidelity visual asset needs the
// library/scene workflow, not the legacy primitive JSON exporter.
export function shouldUseAssetStudio(prompt: string) {
  // Follow-up edits belong to the existing conversation, not a fresh catalog search.
  if (/^(?:please\s+)?(?:now\s+)?(?:make|change|update|improve|modify|resize|recolor|paint|animate)\s+(?:it|this|that|them|those|the selected|the chosen)\b/i.test(prompt.trim())) return false;
  // A requested interaction needs a runnable build even when the first clause
  // names a physical model.
  if (/\b(?:click(?:s|ed|ing)?|tap(?:s|ped|ping)?|touch(?:es|ed|ing)?|interact(?:s|ed|ing)?|opens?|animate(?:s|d)?|awards?|rewards?|receives?|collect(?:s|ed|ing)?|equip(?:s|ped|ping)?|purchase(?:s|d)?|buy|buys|damage(?:s|d)?|kills?|respawn(?:s|ed|ing)?|save(?:s|d)?|trigger(?:s|ed|ing)?|proximityprompt)\b/i.test(prompt)) return false;
  // Route the visual base first for mixed requests; retain the complete prompt
  // so the selected-model continuation can implement the behavior afterward.
  const visual=prompt.split(/\s+(?:that|which)\s+|\s+with\s+(?:an?\s+)?(?:movement|follow|combat|driving|interaction|script|controller|system)|\s+and\s+(?:make|add|write|give)\b/i)[0];
  if(visual!==prompt&&shouldUseAssetStudio(visual))return true;
  const shapePreference = prompt.replace(/\b(?:not|without|no)\s+(?:(?:made|built)\s+)?(?:(?:out\s+)?of\s+)?(?:bricks?|blocks?|primitives?)\b/gi, '');
  if (/\b(?:blocky|primitive|bricks?|voxel|graybox|greybox|blockout)\b/i.test(shapePreference)) return false;
  if (/\b(?:script|luau|debug|fix|code|controller|system)\b/i.test(prompt)) return false;
  if (/\b(?:do not|don't)\s+(?:build|create|generate|implement)\b|\b(?:research|compare|explain)\b/i.test(prompt)) return false;
  const create = /\b(?:build|create|generate|make|model|assemble|design)\b/i.test(prompt);
  // Default physical-object requests to model choices rather than maintaining
  // a small animal allowlist. Keep abstract work and gameplay generation in chat.
  if (/\b(?:function|datastore|algorithm|tutorial|instructions|plan|story|idea|image|thumbnail|picture|logo|ui|gui|menu|hud|leaderboard|inventory|checkpoint|respawn|combat|currency|saving|animation)\b/i.test(prompt)) return false;
  const subject = prompt.replace(/\b(?:for|in) (?:my |the )?(?:roblox )?game\b/gi, '');
  if (/\b(?:obby|game)\b/i.test(subject)) return false;
  const detailed = /\b(?:detailed|realistic|mesh|furnished|ornate)\b/i.test(subject);
  if (/\b(?:obby|game|button|platform|floor|wall|ramp|stairs|cube|block|sphere)\b/i.test(subject) && !detailed) return false;
  if (/\b(?:it|that|this)\s+(?:work|faster|slower|better|jump|move|follow|spin|change)\b/i.test(subject)) return false;
  return create;
}

export const assetStudioGuidance = "This visual build belongs in Asset Studio. Open **Assets** above the chat and use **Find free Roblox models** to search the Creator Store—no personal library is needed. Choose a model for Studio import instructions. For scene planning, add its reference and measured dimensions to your library, then save this prompt and review the planning estimate. Spark will search your library and assemble a scene plan with transforms and materials. Missing meshes are listed as assets to source—not replaced with primitive approximations. External mesh generation and direct Studio control are not connected yet.";
