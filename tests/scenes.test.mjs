import assert from 'node:assert/strict';
import {validateAsset, validateScene, sceneInstaller, sceneToolSchema} from '../lib/spark/scenes.ts';

const spec = {name: 'Weathered anvil', kind: 'mesh', robloxId: '1234567', sourceUrl: 'https://create.roblox.com/store/asset/1234567', license: 'I own this asset and may use it in my experience.', tags: ['blacksmith', 'metal'], size: [4, 2, 2], material: {material: 'Metal', color: [100, 110, 120], pbr: {normalMap: '3456', roughnessMap: '4567', metalnessMap: '5678'}}};
const asset = {...validateAsset(spec), id: 'anvil', created: 123};
const node = {id: 'anvil-1', name: 'Anvil', assetId: 'anvil', size: [4, 2, 2], position: [0, 2, 0], rotation: [0, 45, 0]};
const plan = {version: 1, name: 'Blacksmith shop', style: 'Weathered timber, warm forge, cold iron.', nodes: [node], missingAssets: [], lighting: {clockTime: 18, brightness: 2, ambient: [80, 70, 60]}};
assert.deepEqual(validateAsset(spec), spec);
assert.deepEqual(validateScene(plan, [asset]), plan);
const normalized = validateScene({...plan, nodes: [{...node, primitive: null, material: {color: null, material: null, transparency: null, reflectance: null, pbr: null}}], lighting: null}, [asset]);
assert.equal(normalized.nodes[0].primitive, undefined);
assert.equal(normalized.nodes[0].material, undefined);
assert.equal(normalized.lighting, undefined);
assert.deepEqual(validateAsset({...spec, tags: ['metal', 'metal']}).tags, ['metal']);
for (const bad of [
  {...spec, robloxId: 123}, {...spec, robloxId: 'rbxassetid://123'}, {...spec, robloxId: '9007199254740992'}, {...spec, robloxId: '0'},
  {...spec, sourceUrl: 'http://example.com'}, {...spec, sourceUrl: 'https://user:pass@example.com'}, {...spec, sourceUrl: 'javascript:alert(1)'},
  {...spec, kind: 'Script'}, {...spec, license: ''}, {...spec, script: 'print(1)'}, {...spec, tags: Array(13).fill('x')},
  {...spec, material: {material: 'MadeUp'}}, {...spec, material: {pbr: {normalMap: 'https://bad.test'}}}, {...spec, size: [Infinity, 2, 2]},
  {...spec, size: [0, 2, 2]}, {...spec, material: {transparency: NaN}}, {...spec, material: {reflectance: 2}}, {...spec, material: {color: [256, 0, 0]}},
]) assert.throws(() => validateAsset(bad));
for (const badNode of [
  {...node, assetId: 'invented'}, {...node, primitive: 'Block'}, {...node, assetId: undefined}, {...node, script: 'bad'},
  {...node, position: [10001, 0, 0]}, {...node, rotation: [0, Infinity, 0]}, {...node, size: [-1, 2, 2]},
  {...node, id: 'bad id'}, {...node, primitive: 'MeshPart', assetId: undefined},
  {...node, assetId: undefined, primitive: 'Block', material: {pbr: {colorMap: '123'}}},
]) assert.throws(() => validateScene({...plan, nodes: [badNode]}, [asset]));
assert.throws(() => validateScene({...plan, nodes: [node, node]}, [asset]), /unique/);
assert.throws(() => validateScene({...plan, nodes: Array(101).fill(node)}, [asset]), /100/);
assert.throws(() => validateScene({...plan, version: 2}, [asset]), /version/);
assert.throws(() => validateScene({...plan, nodes: [], missingAssets: []}, [asset]), /at least/);
assert.throws(() => validateScene({...plan, lighting: {clockTime: 25, brightness: 2, ambient: [0, 0, 0]}}, [asset]));
assert.throws(() => validateScene(plan, [asset, asset]), /unique/);
assert.throws(() => validateScene(plan, [{...asset, robloxId: 'invalid'}]));
assert.throws(() => validateScene({...plan, nodes: [{...node, material: {pbr: {normalMap: '7654321'}}}]}, [asset]), /already registered/);
assert.throws(() => validateScene({...plan, nodes: [{...node, material: {pbr: {colorMap: '3456'}}}]}, [asset]), /already registered/);
assert.equal(validateScene({...plan, nodes: [{...node, material: {pbr: {normalMap: '3456'}}}]}, [asset]).nodes[0].material.pbr.normalMap, '3456');
const model = {...asset, kind: 'model'};
assert.equal(validateScene({...plan, nodes: [{...node, size: [8, 4, 4]}]}, [model]).nodes[0].size[0], 8);
assert.throws(() => validateScene({...plan, nodes: [{...node, size: [8, 2, 2]}]}, [model]), /uniform/);
const unresolved = {...plan, nodes: [], missingAssets: [{name: 'Dog', description: 'A smooth UV-mapped dog mesh with a finished face.'}]};
assert.equal(validateScene(unresolved, []).missingAssets.length, 1);
assert.throws(() => sceneInstaller(unresolved, []), /missing asset/);
const installer = sceneInstaller(plan, [asset]);
assert.match(installer, /AssetService:CreateMeshPartAsync\(Content.fromUri/);
assert.match(installer, /AssetService:LoadAssetAsync/);
assert.match(installer, /not RunService:IsRunning/);
assert.match(installer, /TryBeginRecording/);
assert.match(installer, /FinishRecordingOperation.Cancel/);
assert.match(installer, /FinishRecordingOperation.Commit/);
assert.match(installer, /root:Destroy\(\)/);
assert.match(installer, /CFrame.fromOrientation\(math.rad/);
assert.match(installer, /item:ScaleTo/);
assert.match(installer, /not allowed\[item.ClassName\] then item:Destroy/);
assert.match(installer, /CollectionService:RemoveTag/);
assert.match(installer, /SurfaceAppearance/);
assert.match(installer, /surface.NormalMap/);
assert.match(installer, /SparkRightsAttestation/);
assert.match(installer, /templateCount <= 5000 and templateParts <= 2000/);
assert.doesNotMatch(installer, /AllowInsertFreeAssets\s*=/);
assert.doesNotMatch(installer, /loadstring|require\(|HttpService|SavePlaceAsync/);
assert.ok(installer.indexOf('sanitize(template)') < installer.indexOf('item.Parent = root'));
const dangerous = 'Text"; error("injected") --\n[next line]\\path';
const escaped = sceneInstaller({...plan, name: dangerous}, [asset]);
assert.ok(!escaped.includes('["name"]="' + dangerous + '"'));
assert.ok(escaped.includes('\\010[next line]\\\\path'));
assert.match(escaped, /Text\\"; error\(\\"injected\\"\)/);
const ground = {...node, assetId: undefined, primitive: 'Block', material: {material: 'Slate', color: [50, 50, 50]}};
assert.ok(sceneInstaller({...plan, nodes: [ground]}, []).includes('item.CanCollide = true'));
const walkSchema = schema => {
  if (!schema || typeof schema !== 'object') return;
  if (schema.type === 'object') {
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(schema.required, Object.keys(schema.properties));
  }
  for (const value of Object.values(schema)) if (Array.isArray(value)) value.forEach(walkSchema); else if (typeof value === 'object') walkSchema(value);
};
walkSchema(sceneToolSchema);
assert.deepEqual(sceneToolSchema.required, ['plan']);
console.log('Scene validation, library references, transforms, strict tool schema, PBR and safe Studio export checks passed.');
