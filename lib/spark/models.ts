// Rates checked against OpenAI's model pages on 2026-09-15. These weights
// preserve Spark's existing mini rate and scale other models by provider cost.
export const modelCatalog = {
  "gpt-5-mini": { label: "GPT-5 mini", inputWeight: 1, outputWeight: 5 },
  "gpt-5.6-terra": { label: "GPT-5.6 Terra", inputWeight: 8, outputWeight: 30 },
  "gpt-6-astra": { label: "GPT-6 Astra", inputWeight: 40, outputWeight: 125 },
} as const;
export type ModelId = keyof typeof modelCatalog;
export function selectModel(prompt: string, contextChars = 0, override?: string) {
  if (override && override !== "auto") {
    if (!(override in modelCatalog)) throw new Error("Configured model is not in Spark's priced model catalog.");
    return { model: override as ModelId, reason: "Owner-configured model" };
  }
  const complex = /\b(architecture|race condition|deadlock|data loss|data corruption|exploit|anti[- ]?cheat|security audit|multi[- ]?script|cross[- ]server|datastore|data store|inventory system|trading system)\b/i.test(prompt);
  const task = prompt.replace(/\b(?:no|without)\s+(?:code|scripts?|coding)(?:\s+yet)?\b|\b(?:do not|don't)\s+write\s+(?:code|scripts?)(?:\s+yet)?\b/gi, "");
  const coding = /\b(code|scripts?|models?|luau|debug|fix|implement|refactor|optimi[sz]e)\b/i.test(task) || /```|\bfunction\s*\(/.test(task);
  if (complex || prompt.length > 4000 || (coding && contextChars > 18000))
    return { model: "gpt-6-astra" as const, reason: "Complex systems, extensive code, or difficult debugging" };
  if (coding || prompt.length > 1200 || contextChars > 12000)
    return { model: "gpt-5.6-terra" as const, reason: "Script writing, focused debugging, or substantial context" };
  return { model: "gpt-5-mini" as const, reason: "Short planning, explanations, and simple questions" };
}
export function modelCredits(model: ModelId, inputTokens: number, outputTokens: number) {
  const rate = modelCatalog[model];
  return Math.max(1, Math.ceil((Math.max(0,inputTokens)*rate.inputWeight + Math.max(0,outputTokens)*rate.outputWeight)/1000));
}
