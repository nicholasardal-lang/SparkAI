// Spark retail weights are separate from provider USD pricing. Preserve existing
// retail rates; cached input receives the provider's 90% input discount.
import { isBuildRequest } from "./generation.ts";
export const modelCatalog = {
  "gpt-5-mini": { label: "GPT-5 mini", inputWeight: 1, outputWeight: 5 },
  "gpt-5.6-terra": { label: "GPT-5.6 Terra", inputWeight: 8, outputWeight: 30 },
  "gpt-6-astra": { label: "GPT-6 Astra", inputWeight: 40, outputWeight: 125 },
} as const;
export type ModelId = keyof typeof modelCatalog;
export function selectModel(prompt: string, _contextChars = 0, override?: string) {
  if (override && override !== "auto") {
    if (!(override in modelCatalog)) throw new Error("Configured model is not in Spark's priced model catalog.");
    return { model: override as ModelId, reason: "Owner-configured model" };
  }
  const complex = /\b(architecture|race condition|deadlock|data loss|data corruption|exploit|anti[- ]?cheat|security audit|multi[- ]?script|cross[- ]server|datastore|data store|inventory system|trading system)\b/i.test(prompt);
  const task = prompt.replace(/\b(?:no|without)\s+(?:code|scripts?|coding)(?:\s+yet)?\b|\b(?:do not|don't)\s+write\s+(?:code|scripts?)(?:\s+yet)?\b/gi, "");
  const coding = isBuildRequest(task) || /\b(code|scripts?|models?|luau|debug|fix|implement|refactor|optimi[sz]e)\b/i.test(task) || /```|\bfunction\s*\(/.test(task);
  if (complex || prompt.length > 4000)
    return { model: "gpt-6-astra" as const, reason: "Complex systems, extensive code, or difficult debugging" };
  if (coding || prompt.length > 1200)
    return { model: "gpt-5.6-terra" as const, reason: "Script writing, focused debugging, or substantial context" };
  return { model: "gpt-5-mini" as const, reason: "Short planning, explanations, and simple questions" };
}
export function modelCredits(model: ModelId, inputTokens: number, outputTokens: number, cachedTokens = 0) {
  const rate = modelCatalog[model];
  const cached=Math.min(Math.max(0,cachedTokens),Math.max(0,inputTokens));
  return Math.max(1, Math.ceil(((Math.max(0,inputTokens)-cached*.9)*rate.inputWeight + Math.max(0,outputTokens)*rate.outputWeight)/1000));
}
// Standard text rates per million tokens, verified 2026-09-16 against
// https://developers.openai.com/api/docs/models/compare and /models/gpt-5-mini.
// Estimated provider cost, not a bill: excludes unreported cache writes/tool fees.
export function usageMetrics(model:ModelId, usage:any) {
  const inputTokens=Math.max(0,Number(usage?.input_tokens)||0);
  const outputTokens=Math.max(0,Number(usage?.output_tokens)||0);
  const cachedTokens=Math.min(inputTokens,Math.max(0,Number(usage?.input_tokens_details?.cached_tokens)||0));
  const rates={"gpt-5-mini":[.25,2],"gpt-5.6-terra":[2,12],"gpt-6-astra":[10,50]}[model];
  return {inputTokens,outputTokens,cachedTokens,reasoningTokens:Math.max(0,Number(usage?.output_tokens_details?.reasoning_tokens)||0),estimatedProviderUsd:((inputTokens-cachedTokens*.9)*rates[0]+outputTokens*rates[1])/1e6};
}
