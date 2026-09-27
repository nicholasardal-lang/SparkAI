import { tokens } from "./context.ts";
import type { DB } from "./core.ts";
import { modelCatalog, type ModelId } from "./models.ts";

const rates: Record<ModelId, readonly [number, number]> = {
  "gpt-5-mini": [0.25, 2],
  "gpt-5.6-terra": [2, 12],
  "gpt-6-astra": [10, 50],
};

export class ProviderBudgetError extends Error {}

export function providerReservation(body: string): number {
  const request = JSON.parse(body);
  const model = request.model as ModelId;
  if (!Object.hasOwn(modelCatalog, model)) throw new ProviderBudgetError("AI model is not in the priced catalog.");
  const output = Number(request.max_output_tokens);
  if (!Number.isSafeInteger(output) || output < 1 || output > 32768) throw new ProviderBudgetError("Invalid AI output limit.");
  // Conservative allowance for model tokenizer differences, tool envelopes,
  // hidden prompt tokens and cached-input changes. Failed calls keep their hold.
  const input = tokens(body) * 4 + 4096;
  const [inputRate, outputRate] = rates[model];
  return Math.ceil(input * inputRate + output * outputRate);
}

export async function reserveProviderBudget(db: DB, day: string, capUsd: string | undefined, body: string) {
  if (capUsd === undefined || capUsd.trim() === "") return;
  const dollars = Number(capUsd);
  if (!Number.isFinite(dollars) || dollars < 0 || dollars > 1000) throw new ProviderBudgetError("Invalid AI daily budget configuration.");
  const cap = Math.floor(dollars * 1_000_000);
  const amount = providerReservation(body);
  if (amount > cap) throw new ProviderBudgetError("Spark's daily AI budget is exhausted. Please try tomorrow.");
  const row = await db.prepare(
    "INSERT INTO ai_daily_budget (day,reserved_microusd) VALUES (?,?) ON CONFLICT(day) DO UPDATE SET reserved_microusd=reserved_microusd+excluded.reserved_microusd WHERE reserved_microusd+excluded.reserved_microusd<=? RETURNING reserved_microusd"
  ).bind(day, amount, cap).first();
  if (!row) throw new ProviderBudgetError("Spark's daily AI budget is exhausted. Please try tomorrow.");
}

export function budgetedProviderFetch(db: DB, capUsd: string | undefined, fetcher: typeof fetch): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input) === "https://api.openai.com/v1/responses") {
      if (typeof init?.body !== "string") throw new ProviderBudgetError("AI request could not be budgeted.");
      await reserveProviderBudget(db, new Date().toISOString().slice(0, 10), capUsd, init.body);
    }
    return fetcher(input, init);
  }) as typeof fetch;
}

