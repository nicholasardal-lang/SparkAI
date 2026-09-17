// Keep script/gameplay requests in chat. A high-fidelity visual asset needs the
// library/scene workflow, not the legacy primitive JSON exporter.
export function shouldUseAssetStudio(prompt: string) {
  if (/\b(?:blocky|primitive|bricks?|voxel|graybox|greybox|blockout)\b/i.test(prompt)) return false;
  if (/\b(?:script|luau|debug|fix|code|controller|system)\b/i.test(prompt)) return false;
  if (/\b(?:do not|don't)\s+(?:build|create|generate|implement)\b|\b(?:research|compare|explain)\b/i.test(prompt)) return false;
  const create = /\b(?:build|create|generate|make|model|assemble|design)\b/i.test(prompt);
  const organic = /\b(?:dogs?|cats?|animals?|horses?|dragons?|creatures?|sports? cars?|vehicles?|cars?|trucks?|motorcycles?)\b/i.test(prompt);
  const detailed = /\b(?:detailed|polished|realistic|medieval|weathered|mesh(?:parts?)?|pbr|textured|furnished|organic|blacksmith|high[- ](?:quality|fidelity))\b/i.test(prompt);
  const object = /\b(?:shops?|buildings?|houses?|castles?|environments?|forests?|cities|city|villages?|interiors?|props?|models?|scenes?|assets?|trees?|rocks?|forges?|blacksmith)\b/i.test(prompt);
  return create && (organic || (detailed && object));
}

export const assetStudioGuidance = "This visual build belongs in Asset Studio. Open **Assets** above the chat, add mesh/model references you have permission to use, then save this prompt and review the planning estimate. Spark will search your library and assemble a scene plan with transforms and materials. Missing meshes are listed as assets to source—not replaced with primitive approximations. External mesh generation and direct Studio control are not connected yet.";
