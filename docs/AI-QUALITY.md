# AI quality and usage baseline — September 16, 2026

## Follow-up pass: beginner-build-v4

Files now carry readable titles, including backward-compatible titles for older
files, while technical download names remain stable. The drawer sorts newest
first and cards no longer shrink inside its scrolling flex layout. The structured
contract requires titles and rejects duplicate asset/part names. NPCs, shops,
weapons, UI buttons and similar build requests now enter the structured build path.

Removed redundant Markdown-format instructions from structured generation. Added
small self-contained playable-course guidance, explicit checkpoint spawn rules,
per-body-part lava contact tracking and complete replacement-file instructions.
Roblox spawn constraints were checked against
https://create.roblox.com/docs/reference/engine/classes/Player/RespawnLocation .

`scripts/evaluate-followups.mjs` is an explicitly paid regression that generates a
lava obby with a checkpoint, then changes lava to damage over time. It checks file
titles, stable replacement names and explicit neutral spawn/RespawnLocation code.
These are static checks, not a Luau execution test. Review generated code as well.

Final live results: initial build 10.2s, 1205 input / 1067 output tokens, estimated
$0.015214; follow-up 15.8s, 2224 input / 1732 output, 1202 cached input, estimated
$0.0230684. Both produced `BeginnerObbyBuilder.server.luau` with distinct friendly
titles. Reviewed follow-up code used neutral SpawnLocations and one damage loop
with body-part sets. No Roblox Studio execution was performed. Earlier iterations
included a 60s timeout and code flaws; these remain evidence that one passing run
does not establish universal reliability. The existing timeout and refund policy
is unchanged.

Generation policy: `beginner-build-v3`. Each pass should run the fixture tests,
then explicitly authorized small live evaluations with `scripts/evaluate-generation.mjs`.
The live script spends API funds; reports stay in ignored `work/` and never contain keys.

## Measured live baseline

Fresh conversations using Terra; actual provider-reported token counts. Credits
below apply the new cached-input discount. These direct evaluations do not debit
a user's Spark balance. Latency and cache hits vary between requests.

| Request | Input / cached / output tokens | Spark credits | Estimated API USD | Seconds |
| --- | --- | --- | --- | --- |
| Generate me an obby course | 1143 / 0 / 539 | 26 | 0.008754 | 8.4 |
| Make a small bench model | 1142 / 1130 / 376 | 13 | 0.004762 | 6.0 |
| Write a script that spins a part slowly | 1145 / 1130 / 299 | 10 | 0.003844 | 5.3 |
| Create a cat that jumps when you click a button | 1148 / 0 / 1911 | 67 | 0.025228 | 24.2 |

All produced parseable downloadable files. The cat produced a named model and a
matching server script with a ClickDetector and jump debounce. Code and references
were reviewed, but none of these builds were executed in Roblox Studio. Structural
validation is not gameplay validation or proof of Codex-equivalent capability.

## Accounting and routing

- Keep existing Spark retail weights: mini 1/5, Terra 8/30, Astra 40/125 per
  thousand input/output tokens. Retail credits are not dollars or OpenAI tokens.
- Cached input receives a 90% discount; reasoning tokens are already included in
  output tokens and must not be charged a second time.
- Provider USD estimates use published standard text rates, separately from
  Spark pricing: mini $0.25/$2, Terra $2/$12, Astra $10/$50 per million input/output
  tokens. Cached input is 10% of the input rate. Source:
  https://developers.openai.com/api/docs/models/compare and
  https://developers.openai.com/api/docs/models/gpt-5-mini . Estimates exclude
  unreported cache-write charges, tools, taxes and ambiguous timed-out work;
  the provider billing dashboard remains authoritative.
- Task difficulty determines routing. Long conversation history alone no longer
  promotes a small task to Astra. Hard systems/debugging still select Astra.
- Quotes count the same instructions/schema/context sent to the provider, using
  an explicit local token approximation. Expected output depends on task type.
  Maximum reservations include headroom and the output cap. They are not predicted
  charges. Settlement never exceeds the accepted maximum; Spark absorbs excess.
- Invalid quotes neither save a new message nor consume an AI attempt. Insufficient
  credits do not consume the daily AI allowance or provider-attempt count.
- `spark_ai_response` records token/cache/reasoning counts, estimated provider USD,
  model, latency and provider request ID, including returned incomplete responses.
  `spark_credit_settlement` records estimate, reservation and final credits. Logs
  exclude prompts, replies and credentials. Retention is the host's log retention;
  these are diagnostics, not a permanent accounting export.

## Next quality passes

Test follow-up edits retaining existing file names; checkpoint respawns; mobile
input; server validation; and interrupted requests. Add actual Studio playtesting
before promising runtime correctness. Compare quality, failure rate, cost and
latency on the same prompts before changing routing or prompting. Spark does not
automatically train itself from these evaluations.
