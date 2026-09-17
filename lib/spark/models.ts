// Spark retail weights are separate from provider USD pricing. Preserve existing
// retail rates; cached input receives the provider's 90% input discount.
import { isBuildRequest } from "./generation.ts";
export const modelCatalog = {
  "gpt-5-mini": { label: "GPT-5 mini", inputWeight: 1, outputWeight: 5 },
  "gpt-5.6-terra": { label: "GPT-5.6 Terra", inputWeight: 8, outputWeight: 30 },
  "gpt-6-astra": { label: "GPT-6 Astra", inputWeight: 40, outputWeight: 125 },
} as const;
export type ModelId = keyof typeof modelCatalog;
export type ChatTurn = {role:string; content:string};
export type TaskState = {complexity: "simple"|"coding"|"complex"; structuredBuild:boolean};
export function taskState(prompt:string):TaskState {
  // Explicit conceptual questions do not need the implementation route merely
  // because they mention security or DataStore. Length alone is not complexity.
  const conceptual=/^(?:what (?:is|are|does)|define|explain (?:what|the meaning)|give me .*ideas|plan .*no code)/i.test(prompt.trim()) && !/```|\b(?:implement|debug|audit|fix|write .*script)\b/i.test(prompt);
  const build=isBuildRequest(prompt);
  const codeBlocks=(prompt.match(/```/g)||[]).length/2;
  const implementation=/\b(?:design|architect|implement|build|create|write|audit|debug|fix|review|secure|refactor|investigate|optimi[sz]e)\b/i.test(prompt);
  const difficult=/\b(?:architecture|race condition|deadlock|data loss|data corruption|exploits?|anti[- ]?cheat|security|multi[- ]?(?:script|file)|cross[- ]server|datastore|data store|inventory system|trading system)\b/i.test(prompt);
  const multiCode=codeBlocks>=2 && /\b(?:debug|fix|interact|together|error|architecture)\b/i.test(prompt);
  const task=prompt.replace(/\b(?:no|without)\s+(?:code|scripts?|coding)(?:\s+yet)?\b|\b(?:do not|don't)\s+write\s+(?:code|scripts?)(?:\s+yet)?\b/gi, "");
  const coding=build || codeBlocks>0 || /\b(?:code|scripts?|luau|debug|fix|implement|refactor|optimi[sz]e)\b/i.test(task);
  return {complexity:conceptual?"simple":(implementation&&difficult)||multiCode?"complex":coding?"coding":"simple",structuredBuild:!conceptual&&build};
}
export function isTaskFollowup(prompt:string) {
  return /^(?:yes|yep|ok(?:ay)?|sure|continue|go ahead|do (?:it|that)|proceed|finish(?: it)?)[.!\s]*$/i.test(prompt.trim()) ||
    /\b(?:continue|same (?:code|script|system)|that (?:bug|error|approach)|previous (?:answer|script)|still (?:broken|fails)|doesn't work)\b/i.test(prompt) ||
    /^(?:yes|ok(?:ay)?|sure)[,!.]?\s+(?:do that|go ahead|continue|please do)\b/i.test(prompt.trim()) ||
    /^(?:now )?(?:fix|debug|change|update|extend|add to|improve|make) (?:it|this|that|those|them)\b/i.test(prompt.trim()) ||
    /^(?:now|also)\s+(?:add|change|extend|implement|fix)\b/i.test(prompt.trim());
}
export function selectModel(prompt: string, history: ChatTurn[]|number = [], override?: string, remembered?:TaskState) {
  let active:TaskState=remembered||{complexity:"simple",structuredBuild:false};
  let previousAssistant="";
  for(const turn of Array.isArray(history)?history:[]) {
    if(turn.role==="assistant") {previousAssistant=turn.content;continue;}
    if(turn.role!=="user") continue;
    const next=taskState(turn.content);
    if(!isTaskFollowup(turn.content)) active=next;
    else if(next.complexity==="complex" || (next.complexity==="coding"&&active.complexity==="simple")) active=next;
  }
  const own=taskState(prompt),followup=isTaskFollowup(prompt);
  let task=own;
  if(followup) {
    const ranks={simple:0,coding:1,complex:2};
    const proposal=taskState(previousAssistant.replace(/```[\s\S]*?```/g,""));
    task={complexity:ranks[own.complexity]>ranks[active.complexity]?own.complexity:active.complexity,structuredBuild:own.structuredBuild||active.structuredBuild};
    // A specific assistant proposal can raise the follow-up's effort, but a
    // generic explanation of a costly topic cannot raise independent requests.
    if(/\b(?:shall I|would you like|next (?:we|I) can|I can (?:implement|build))\b/i.test(previousAssistant)&&ranks[proposal.complexity]>ranks[task.complexity]) task={...proposal,structuredBuild:task.structuredBuild||proposal.structuredBuild};
  }
  const reasoning=task.complexity==="complex"?"high":task.complexity==="coding"?"medium":"low";
  const selected:ModelId=task.complexity==="complex"?"gpt-6-astra":task.complexity==="coding"?"gpt-5.6-terra":"gpt-5-mini";
  if (override && override !== "auto") {
    if (!(override in modelCatalog)) throw new Error("Configured model is not in Spark's priced model catalog.");
    return { model: override as ModelId, reason: "Owner-configured model", reasoning, ...task };
  }
  return {model:selected,reason:followup?"Continuing the active task":task.complexity==="complex"?"Complex implementation or debugging":task.complexity==="coding"?"Focused coding task":"Simple question or planning",reasoning,...task};
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
