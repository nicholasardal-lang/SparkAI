# Spark Studio bridge — first release

Website: project sidebar → **Connect Roblox Studio**. Install the downloaded local plugin using the instructions there, pair the open place, then use **Send to Studio** under a reply. In Studio choose **Refresh builds**, review the destinations and full script source, then **Approve and insert**.

Supported: complete chat script files, validated part-based models, and the chosen Creator Store model from a response. Asset Studio scene jobs are not transferred by this first release. Scripts are inserted disabled; library imports preserve the AssetService sandbox. Existing objects are not overwritten. Missing parents block the entire operation; Spark does not guess whether a missing container should be a Tool, Folder, or Model. A model and its dependent scripts can be sent together in the same response.

## Connection and transfer contract

- Browser endpoints retain session, origin, paid-access and project-owner checks.
- Five-minute, 256-bit random pairing secret; SHA-256 stored; atomic single-use exchange.
- One connection per project; token expires after 24 hours and is held in plugin memory only. New pairing/revocation invalidates the old token.
- Plugin token can read pending transfers and acknowledge outcomes for its project only. It cannot call chat, spend credits, or enumerate accounts. Place ID is bound at exchange; unsaved places have ID zero, so a new plugin session must be paired for each unsaved place.
- Pending transfers expire after 24 hours. Payloads are immutable, extracted server-side from owned assistant messages, capped at 12 items/240 KB, and deduplicated by content hash. Rejected/expired transfers are not silently resurrected.
- Plugin stages objects before parenting them, validates destinations, blocks Play mode and collisions, uses a ChangeHistoryService recording, and destroys staged objects on failure.
- Applied receipts are retried without repeating insertion. Per-object transfer attributes prevent reinsertion after a plugin restart. If recovery finds existing objects it stops for inspection; it does not infer that a partially recovered build succeeded.
- Revoke does not remove previously inserted objects. Undo does not requeue an applied transfer. Imported content has not been executed or tested by Spark.

## Release verification

Automated: `tests/studio.test.mjs` covers authentication/CSRF, code/token expiry, single use, project/place isolation, revocation, destination validation, payload generation, duplicate enqueue and acknowledgement retries. Run existing core tests, TypeScript and production build too.

Requires a real Roblox Studio session (not replaced by website tests): install local plugin; allow HTTP permission; pair a copy of a place; send a small model and script; verify review/source, disabled scripts, exact parents, selection and Undo/Redo. Test a catalog asset with third-party loading both off and on; retain sandbox. Try missing parents, existing names, Play mode, expired code, revoked token, interrupted acknowledgement and reopening the place. Verify nothing is inserted without approval and failed staging leaves no partial objects. Studio runtime verification remains pending until this checklist is exercised.

Official references: [plugins](https://create.roblox.com/docs/studio/plugins), [script editing](https://create.roblox.com/docs/reference/engine/classes/ScriptEditorService), [undo recording](https://create.roblox.com/docs/reference/engine/classes/ChangeHistoryService), [asset loading](https://create.roblox.com/docs/reference/engine/classes/AssetService).
