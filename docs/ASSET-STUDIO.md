# Asset Studio — library-first hybrid pipeline

Status: first implementation milestone, September 17, 2026. This is a **saved asset library + tool-using scene planner + reviewed static Studio import**, not an autonomous 3D generation service. Pushing this source to GitHub does not publish the hosted Spark website.

## What this release does

- Saves project-owned references to existing Roblox mesh assets or multi-mesh Model assets, with measured dimensions, tags, source URL, and a required license/rights attestation.
- Preserves source geometry, UV mapping, textures and component appearances in multi-mesh models. Supports explicit Roblox material, color, transparency, reflectance and SurfaceAppearance color/normal/roughness/metalness map overrides.
- Uses OpenAI Responses function calling to search those references and submit a scene plan. The LLM specifies references, art direction, dimensions and transforms; it does not encode mesh triangles or author executable importer code.
- Saves queued/running/complete/failed planning jobs. Running attempts have a six-minute fenced lease; interruption never triggers an automatic paid retry. Each attempt snapshots its library inputs so later library removal cannot break completed exports.
- Quotes and reserves Spark Credits before an explicit planning confirmation. A run uses at most three provider calls, including one possible validation repair. Successful plans settle actual reported usage (conservative capped fallback when usage is absent); failed planning refunds the reservation. Existing daily and per-user/IP AI limits apply.
- Produces a `.studio.luau` installer from a fixed, reviewed template. Users inspect it and run it in Studio **Edit mode**. It creates a new scene, supports undo and rolls back failed imports. It does not publish a place.
- Routes recognizable detailed asset requests away from legacy primitive chat downloads into Asset Studio. Explicit blockouts, primitive builds and gameplay scripts still use the existing chat workflow.

`complete` means **planning completed**, not that assets are available in Studio, permissions passed, visual quality passed, or a game is finished. A plan with missing assets remains blocked from export.

## Use it

1. Apply all D1 migrations, including `drizzle/0008_scene_asset_pipeline.sql`, using your normal deployment/database workflow. Never point a local test command at the production database. See the README for local D1 setup.
2. Open a project and choose **Assets**. Add assets you own or are licensed to use. Mesh IDs and Model IDs are different asset types; a catalog/product/Decal ID is not automatically a valid mesh or image ID.
3. For a multi-mesh Model, measure its actual `Model:GetBoundingBox()` dimensions in Studio and enter them in studs. Preserve its aspect ratio when specifying scene size. Source models are checked against those bounds during import, with a 5%/0.05-stud tolerance.
4. For an external `.fbx`, `.gltf` or `.glb`, first use Studio's 3D Importer, inspect the geometry/materials, and save the resulting model under the correct Roblox owner. Register that resulting Roblox asset ID in Spark. This release does not upload arbitrary external files for you.
5. Give assets useful style/function tags, for example `medieval`, `weathered`, `timber`, `forge`, `warm-interior`. Register image map IDs on assets if you want material overrides. AI scene overrides can only reuse registered IDs in the same map role; the AI cannot invent texture IDs.
6. Save a scene prompt. Saving, estimating and library management do not call OpenAI. Review the model, estimated cost and maximum reservation, then explicitly run planning.
7. Review art direction, placements and missing asset requests. Source missing assets and create a revised scene plan. No geometry is secretly substituted for missing hero assets.
8. When the plan has no missing assets, download and review the installer. Back up your place, stop Play/Run, then paste the reviewed source into Studio's Command Bar. Review the result and test collisions, performance and appearance on target devices before publishing.

Never paste OpenAI, Roblox or 3D-provider credentials into an asset field. `sourceUrl` is provenance metadata only; Spark does not fetch it or verify a license automatically. Rights attestations are recorded, not legal clearance or Roblox permission grants.

## Example: medieval blacksmith shop

Prompt: “Create a detailed medieval blacksmith shop with weathered timber framing, stone foundation, tiled roof, forge, chimney, tools, barrels, signs and a furnished interior.”

The intended workflow is:

1. Establish one art direction in the plan: timber/stone palette, wear, scale, roof silhouette, interior circulation and warm forge versus cool daylight.
2. Search the project library for compatible modular walls, timber beams, roof sections, forge, anvil, barrels, tools, furniture and signage.
3. Reuse existing multi-mesh assemblies for detailed forms. Use procedural Parts only where their geometry is appropriate, such as a floor or straight structural beam.
4. Record explicit sourcing briefs for unavailable components. With an empty library, expect a useful missing-assets plan, **not a polished blacksmith fabricated from bricks**.
5. Position and rotate referenced assets, preserve their existing UV/PBR appearance, and configure basic scene lighting. Save the plan and its immutable asset-input snapshot.
6. Validate data before export and validate source geometry/permissions during the user-approved Studio import. Human review and device testing remain necessary.

This first release has no visual render/critique loop. Text planning cannot prove that a model looks good or that all placements are collision-free.

## Architecture and boundaries

```text
Prompt + project art direction
        ↓
Durable scene job → explicit cost confirmation → credit reservation
        ↓
Bounded OpenAI planner ← search_project_assets → project library snapshot
        ↓ submit_scene
Strict scene/reference/material validation
        ↓
Atomic saved plan + credit settlement
        ↓
Reviewed deterministic installer → Studio Edit-mode import → manual QA
```

Important modules:

- `lib/spark/scenes.ts`: versioned asset/scene types, strict validation, allowlists and installer.
- `lib/spark/asset-store.ts`: project-scoped records, caps, snapshotting, idempotent job creation, lease fencing and atomic completion statements.
- `lib/spark/scene-planner.ts`: bounded search/propose tools and price quote. No web search, arbitrary code execution, file fetch, purchase or upload tool is exposed.
- `lib/spark/core.ts`: authenticated API, project ownership, origin checks, quotas, project lock and existing credit ledger integration.
- `app/projects/[id]/asset-studio.tsx`: library, planning confirmation, job history, unresolved-assets review and installer download.

API routes live under `/api/projects/:projectId`:

| Route | Method | Purpose |
| --- | --- | --- |
| `/assets` | GET / POST | List or register approved asset references |
| `/assets/:assetId` | DELETE | Remove a library reference, not the original Roblox asset |
| `/scene-jobs` | GET / POST | List jobs or save `{id: UUID, prompt}` idempotently |
| `/scene-jobs/:jobId` | GET | Read a saved job |
| `/scene-jobs/:jobId/estimate` | POST | Get a quote; no provider call |
| `/scene-jobs/:jobId/run` | POST | Confirm `{model,maxCredits}` and run bounded planning |
| `/scene-jobs/:jobId/export` | GET | Download source from a completed, fully resolved plan |

The running request performs the bounded provider loop; this is **not a background queue worker**. If the request/process stops, durable status is recovered as failed when its lease expires. Saved jobs are not automatically resumed and there is no exactly-once guarantee for provider billing after an ambiguous network failure. Spark does not charge its user for a failed plan; an upstream provider may still have charged Spark. Expired credit reservations are reclaimed on the next reservation by the existing credit subsystem.

Limits in this release: 200 assets and 100 saved scene jobs per project; 100 scene nodes and 20 missing asset briefs per plan. Search returns at most 30 matches within a token budget. A source model and resulting scene are bounded during import; these safety caps are not mobile performance certification.

## Security and importer behavior

All endpoints inherit Spark authentication, paid-workspace checks, same-origin mutation protection, body-size caps and parameterized queries. Every query/mutation is project scoped. API responses omit internal lease tokens and full library snapshots.

Imported third-party content is kept outside the DataModel while inspected. The fixed exporter removes scripts, controllers, joints/constraints, package links, non-allowlisted instances, tags and attributes before parenting. Allowed static geometry, SurfaceAppearances, decals/textures, attachments/bones and bounded lights/particles can survive. Parts are anchored and touch disabled. Imported collision flags are preserved; mesh imports use hull collision. This intentionally makes a **static visual scene**, not a drivable car, animated dog or gameplay system. Source tags/attributes are removed to avoid triggering existing game systems.

Global Lighting changes, when requested in the plan, are explicitly described in the installer and part of the undo recording. The importer does not enable third-party loading security settings, install plugins, modify existing scene models or publish anything. Asset ownership/moderation and image visibility are still enforced by Roblox, and errors can require manual action.

## Costs and configuration

This milestone adds no new required provider account: it uses the existing server-only `OPENAI_API_KEY`, `OPENAI_MODEL`, `AI_MAX_OUTPUT_TOKENS`, `DAILY_MESSAGE_LIMIT` and D1 binding. Default scene planning uses the existing priced `gpt-5.6-terra` catalog entry; an explicit supported owner model override is respected.

The displayed maximum covers all bounded rounds and worst-case output; it is a reservation, not the expected final charge. Actual scene token counts vary by library, plan detail and validation repairs. Spark retail credit weights remain those in `lib/spark/models.ts`; they are not the same as provider USD pricing. There are no third-party 3D generation charges, purchases or uploads in this milestone. No live provider cost or visual-quality benchmark has been claimed from mocked tests.

## Remaining phases of the approved hybrid design

1. **Quality benchmark and library curation:** benchmark dog/car/blacksmith/forest scenes; curate licensed multi-mesh kits, pivots, collision proxies and materials; define target-device budgets and acceptance images.
2. **Generation/import workers:** add one real 3D provider behind cost approval, persisted provider task IDs, timeout reconciliation and artifact retention. Add object storage, isolated Blender normalization/decimation/UV/baking workers and provenance hashes. Failed or ambiguous submits must not be blindly repeated.
3. **Authorized Roblox bridge:** authenticate the correct creator/group, upload/import with moderation and permissions checks, then connect a local Studio companion/MCP bridge with explicit edit scope, dry-run/undo and screenshot feedback. A remote web server cannot assume access to the user's desktop Studio session.
4. **Materials and scene polish:** reusable tileable MaterialVariants, AI texture drafts with validated PBR/UV processing, terrain, deliberate particle/effect authoring, spatial validation, render-and-critique iteration, per-device performance measurement and coherent project style records.
5. **Advanced assets:** rigging/animation, articulated vehicles, navigation/gameplay integration and targeted asset regeneration. A nice mesh alone is not an animated or functioning asset.

External tools under consideration remain Meshy/Tripo (specialized meshes), Blender (geometry processing and baking), OpenAI image generation (texture/concept drafts, not guaranteed UV/PBR maps), Roblox Studio tools/GenerationService/Open Cloud (authorized platform generation/import). These are architectural next steps, **not installed or advertised as working integrations** in this release.

## Verification and release checklist

```sh
node --experimental-strip-types --test tests/scenes.test.mjs tests/asset-store.test.mjs tests/scene-pipeline.test.mjs
node --experimental-strip-types --test tests/core.test.mjs tests/generation.test.mjs tests/artifacts.test.mjs tests/chat-quality.test.mjs
npx tsc --noEmit
npm run build
```

Tests use an isolated SQLite database and explicitly fake provider/asset fixtures. Fixture IDs do not represent endorsed or accessible Roblox assets. Before production activation, apply migrations, verify server secrets privately, run an actual bounded planner test, and import a licensed representative multi-mesh scene in Studio. No live Roblox import, provider response quality, mobile performance or production deployment is certified by local unit tests.

Implementation verification on September 17, 2026: all 11 non-HTTP test files passed, TypeScript passed, the production build passed, and the new modules/Asset Studio component passed targeted ESLint. Existing chat/core files retain unrelated lint debt; repository-wide lint is not claimed clean. A separate local D1 database accepted all nine migrations. Browser checks covered detailed-prompt handoff, registering a mesh/PBR metadata fixture, saved brief/library persistence, disabled-AI messaging and a 390-pixel mobile viewport with no horizontal overflow or browser console errors. The legacy fixed-port HTTP suite was not used; these browser checks exercised the actual built Worker on isolated QA ports instead. No real OpenAI or Roblox generation/import was run.

Primary references checked during implementation:

- [OpenAI function calling](https://developers.openai.com/api/docs/guides/function-calling): application-executed functions, strict schemas and reasoning-item continuation.
- [Roblox AssetService](https://create.roblox.com/docs/reference/engine/classes/AssetService) and [Content](https://create.roblox.com/docs/reference/engine/datatypes/Content): model loading and mesh creation.
- [Roblox Model](https://create.roblox.com/docs/reference/engine/classes/Model): scaling, bounds and transforms.
- [SurfaceAppearance](https://create.roblox.com/docs/reference/engine/classes/SurfaceAppearance): UV-based PBR appearance.
- [ChangeHistoryService](https://create.roblox.com/docs/reference/engine/classes/ChangeHistoryService): undoable edits.
- [Studio 3D Importer](https://create.roblox.com/docs/art/modeling/3d-importer): external asset import.
