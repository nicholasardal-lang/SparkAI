/** Versioned scene data, not executable model-authored code or inline mesh geometry. */
export type Triple = [number, number, number];
export const ROBLOX_MATERIALS = ["Plastic", "SmoothPlastic", "Neon", "Wood", "WoodPlanks", "Marble", "Slate", "Concrete", "Granite", "Brick", "Pebble", "Cobblestone", "Rock", "Sandstone", "Basalt", "CrackedLava", "Limestone", "Pavement", "CorrodedMetal", "DiamondPlate", "Foil", "Metal", "Grass", "LeafyGrass", "Sand", "Fabric", "Snow", "Mud", "Ground", "Asphalt", "Salt", "Ice", "Glacier", "Glass", "ForceField"] as const;
export type MaterialSpec = {
  color?: Triple; material?: typeof ROBLOX_MATERIALS[number]; transparency?: number; reflectance?: number;
  pbr?: {colorMap?: string; normalMap?: string; roughnessMap?: string; metalnessMap?: string};
};
export type AssetSpec = {name: string; kind: "mesh" | "model"; robloxId: string; sourceUrl: string; license: string; tags: string[]; size: Triple; material?: MaterialSpec};
export type LibraryAsset = AssetSpec & {id: string; created: number};
export type SceneNode = {id: string; name: string; assetId?: string; primitive?: "Block" | "Ball" | "Cylinder" | "Wedge"; size: Triple; position: Triple; rotation: Triple; material?: MaterialSpec};
export type ScenePlan = {version: 1; name: string; style: string; nodes: SceneNode[]; missingAssets: {name: string; description: string}[]; lighting?: {clockTime: number; brightness: number; ambient: Triple}};

function object(input: unknown, allowed: string[], context: string): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input) || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw new Error(`${context} must be an object.`);
  if (Object.keys(input).some(key => !allowed.includes(key))) throw new Error(`${context} contains unsupported fields.`);
  return input as Record<string, unknown>;
}
function string(input: unknown, min: number, max: number, context: string): string {
  if (typeof input !== "string" || input.trim().length < min || input.length > max || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(input)) throw new Error(`${context} must contain ${min}–${max} characters of text.`);
  return input.trim();
}
function number(input: unknown, min: number, max: number, context: string): number {
  if (typeof input !== "number" || !Number.isFinite(input) || input < min || input > max) throw new Error(`${context} must be a finite number between ${min} and ${max}.`);
  return input;
}
function triple(input: unknown, min: number, max: number, context: string): Triple {
  if (!Array.isArray(input) || input.length !== 3) throw new Error(`${context} needs exactly three numbers.`);
  return input.map(value => number(value, min, max, context)) as Triple;
}
function identifier(input: unknown, context: string): string {
  const value = string(input, 1, 80, context);
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) throw new Error(`${context} may contain only letters, numbers, underscores, and hyphens.`);
  return value;
}
function assetId(input: unknown, context: string): string {
  if (typeof input !== "string" || !/^[1-9]\d{0,15}$/.test(input) || !Number.isSafeInteger(Number(input))) throw new Error(`${context} must be a positive Roblox asset ID, not a URL.`);
  return input;
}
function material(input: unknown): MaterialSpec | undefined {
  if (input == null) return undefined;
  const value = object(input, ["color", "material", "transparency", "reflectance", "pbr"], "Material"), result: MaterialSpec = {};
  if (value.color != null) result.color = triple(value.color, 0, 255, "Material color");
  if (value.material != null) {
    if (typeof value.material !== "string" || !(ROBLOX_MATERIALS as readonly string[]).includes(value.material)) throw new Error("Choose a supported Roblox material.");
    result.material = value.material as MaterialSpec["material"];
  }
  if (value.transparency != null) result.transparency = number(value.transparency, 0, 1, "Transparency");
  if (value.reflectance != null) result.reflectance = number(value.reflectance, 0, 1, "Reflectance");
  if (value.pbr != null) {
    const maps = object(value.pbr, ["colorMap", "normalMap", "roughnessMap", "metalnessMap"], "PBR maps");
    const pbr: NonNullable<MaterialSpec["pbr"]> = {};
    for (const key of ["colorMap", "normalMap", "roughnessMap", "metalnessMap"] as const) if (maps[key] != null) pbr[key] = assetId(maps[key], key);
    if (Object.keys(pbr).length) result.pbr = pbr;
  }
  return Object.keys(result).length ? result : undefined;
}

export function validateAsset(input: unknown): AssetSpec {
  const value = object(input, ["name", "kind", "robloxId", "sourceUrl", "license", "tags", "size", "material"], "Asset");
  if (value.kind !== "mesh" && value.kind !== "model") throw new Error("Asset kind must be mesh or model.");
  const sourceUrl = string(value.sourceUrl, 0, 1000, "Source URL");
  if (sourceUrl) {
    let url: URL;
    try { url = new URL(sourceUrl); } catch { throw new Error("Source URL must be a valid HTTPS URL."); }
    if (url.protocol !== "https:" || url.username || url.password) throw new Error("Source URL must be HTTPS without embedded credentials.");
  }
  if (!Array.isArray(value.tags) || value.tags.length > 12) throw new Error("Asset tags must be a list of at most 12 tags.");
  const result: AssetSpec = {name: string(value.name, 1, 80, "Asset name"), kind: value.kind, robloxId: assetId(value.robloxId, "Roblox ID"), sourceUrl, license: string(value.license, 3, 500, "License or rights attestation"), tags: [...new Set(value.tags.map(tag => string(tag, 1, 40, "Tag")))], size: triple(value.size, 0.05, 2048, "Asset dimensions")};
  const appearance = material(value.material);
  if (appearance) result.material = appearance;
  return result;
}

function libraryIndex(assets: LibraryAsset[]): Map<string, LibraryAsset> {
  if (!Array.isArray(assets) || assets.length > 500) throw new Error("Asset library exceeds the 500-asset limit.");
  const result = new Map<string, LibraryAsset>();
  for (const input of assets) {
    const value = object(input, ["id", "created", "name", "kind", "robloxId", "sourceUrl", "license", "tags", "size", "material"], "Library asset");
    const {id, created, ...spec} = value;
    const key = identifier(id, "Library asset ID");
    if (result.has(key)) throw new Error("Library asset IDs must be unique.");
    result.set(key, {...validateAsset(spec), id: key, created: number(created, 0, Number.MAX_SAFE_INTEGER, "Asset creation time")});
  }
  return result;
}

export function validateScene(input: unknown, assets: LibraryAsset[]): ScenePlan {
  const library = libraryIndex(assets), value = object(input, ["version", "name", "style", "nodes", "missingAssets", "lighting"], "Scene");
  if (value.version !== 1) throw new Error("Unsupported scene version.");
  if (!Array.isArray(value.nodes) || value.nodes.length > 100) throw new Error("A scene may contain at most 100 nodes.");
  if (!Array.isArray(value.missingAssets) || value.missingAssets.length > 20) throw new Error("A scene may request at most 20 missing assets.");
  const ids = new Set<string>();
  const nodes: SceneNode[] = value.nodes.map(inputNode => {
    const node = object(inputNode, ["id", "name", "assetId", "primitive", "size", "position", "rotation", "material"], "Scene node");
    const id = identifier(node.id, "Scene node ID");
    if (ids.has(id)) throw new Error("Scene node IDs must be unique.");
    ids.add(id);
    if ((node.assetId != null) === (node.primitive != null)) throw new Error("Each scene node needs exactly one library asset or primitive.");
    const result: SceneNode = {id, name: string(node.name, 1, 80, "Node name"), size: triple(node.size, 0.05, 2048, "Node size"), position: triple(node.position, -10000, 10000, "Node position"), rotation: triple(node.rotation, -3600, 3600, "Node rotation in degrees")};
    if (node.assetId != null) {
      result.assetId = identifier(node.assetId, "Library asset reference");
      const asset = library.get(result.assetId);
      if (!asset) throw new Error(`Scene references an asset outside this library: ${result.assetId}.`);
      if (asset.kind === "model") {
        const ratios = result.size.map((size, i) => size / asset.size[i]);
        if (ratios.some(ratio => Math.abs(ratio / ratios[0] - 1) > 0.001)) throw new Error(`Model ${asset.name} must be scaled uniformly; preserve its library dimensions' proportions.`);
      }
    } else {
      if (typeof node.primitive !== "string" || !["Block", "Ball", "Cylinder", "Wedge"].includes(node.primitive)) throw new Error("Unsupported primitive shape.");
      result.primitive = node.primitive as SceneNode["primitive"];
    }
    const appearance = material(node.material);
    if (appearance?.pbr && result.primitive) throw new Error("SurfaceAppearance PBR maps require a mesh asset, not a primitive.");
    if (appearance?.pbr) {
      for (const key of ["colorMap", "normalMap", "roughnessMap", "metalnessMap"] as const) {
        const mapId = appearance.pbr[key];
        if (mapId && ![...library.values()].some(asset => asset.material?.pbr?.[key] === mapId)) throw new Error(`The ${key} override must reference a map already registered in the asset library.`);
      }
    }
    if (appearance) result.material = appearance;
    return result;
  });
  const missingAssets = value.missingAssets.map(inputMissing => {
    const missing = object(inputMissing, ["name", "description"], "Missing asset");
    return {name: string(missing.name, 1, 80, "Missing asset name"), description: string(missing.description, 1, 500, "Missing asset description")};
  });
  if (!nodes.length && !missingAssets.length) throw new Error("A scene needs at least one node or missing asset request.");
  const result: ScenePlan = {version: 1, name: string(value.name, 1, 80, "Scene name"), style: string(value.style, 1, 2000, "Art direction"), nodes, missingAssets};
  if (value.lighting != null) {
    const light = object(value.lighting, ["clockTime", "brightness", "ambient"], "Lighting");
    result.lighting = {clockTime: number(light.clockTime, 0, 24, "Clock time"), brightness: number(light.brightness, 0, 10, "Brightness"), ambient: triple(light.ambient, 0, 255, "Ambient color")};
  }
  return result;
}

// All object properties are required for strict function calling. Nullable optional
// properties are normalized by validateScene; semantic constraints are checked again.
const nullable = (schema: Record<string, unknown>) => ({anyOf: [schema, {type: "null"}]});
const strictObject = (properties: Record<string, unknown>) => ({type: "object", properties, required: Object.keys(properties), additionalProperties: false});
const textSchema = (maxLength: number) => ({type: "string", minLength: 1, maxLength});
const tripleSchema = (minimum: number, maximum: number) => ({type: "array", items: {type: "number", minimum, maximum}, minItems: 3, maxItems: 3});
const mapSchema = nullable({type: "string", pattern: "^[1-9][0-9]{0,15}$"});
const materialSchema = nullable(strictObject({color: nullable(tripleSchema(0, 255)), material: nullable({type: "string", enum: ROBLOX_MATERIALS}), transparency: nullable({type: "number", minimum: 0, maximum: 1}), reflectance: nullable({type: "number", minimum: 0, maximum: 1}), pbr: nullable(strictObject({colorMap: mapSchema, normalMap: mapSchema, roughnessMap: mapSchema, metalnessMap: mapSchema}))}));
export const sceneToolSchema = strictObject({plan: strictObject({version: {type: "integer", enum: [1]}, name: textSchema(80), style: textSchema(2000), nodes: {type: "array", maxItems: 100, items: strictObject({id: {type: "string", pattern: "^[a-zA-Z0-9_-]{1,80}$"}, name: textSchema(80), assetId: nullable(textSchema(80)), primitive: nullable({type: "string", enum: ["Block", "Ball", "Cylinder", "Wedge"]}), size: tripleSchema(0.05, 2048), position: tripleSchema(-10000, 10000), rotation: tripleSchema(-3600, 3600), material: materialSchema})}, missingAssets: {type: "array", maxItems: 20, items: strictObject({name: textSchema(80), description: textSchema(500)})}, lighting: nullable(strictObject({clockTime: {type: "number", minimum: 0, maximum: 24}, brightness: {type: "number", minimum: 0, maximum: 10}, ambient: tripleSchema(0, 255)}))})});

// Encode data as quoted Luau literals, never interpolate user text as executable code.
function lua(input: unknown): string {
  if (input == null) return "nil";
  if (typeof input === "number") return String(input);
  if (typeof input === "string") return '"' + input.replace(/[\\"\x00-\x1f\x7f]/g, c => c === "\\" ? "\\\\" : c === '"' ? '\\"' : "\\" + String(c.charCodeAt(0)).padStart(3, "0")) + '"';
  if (Array.isArray(input)) return `{${input.map(lua).join(",")}}`;
  return `{${Object.entries(input as Record<string, unknown>).map(([key, value]) => `[${lua(key)}]=${lua(value)}`).join(",")}}`;
}

/** Reviewed static installer for Studio's Command Bar in Edit mode. Never auto-publishes. */
export function sceneInstaller(input: ScenePlan, assets: LibraryAsset[]): string {
  const plan = validateScene(input, assets);
  if (plan.missingAssets.length) throw new Error("Resolve every missing asset and regenerate the scene before exporting to Studio.");
  const used = new Set(plan.nodes.flatMap(node => node.assetId ? [node.assetId] : []));
  const library = Object.fromEntries([...libraryIndex(assets)].filter(([id]) => used.has(id)));
  return `-- Spark scene installer v1. Review, then paste into Studio's Command Bar in EDIT mode.
-- Static scene only: scripts, controllers, constraints, package links, tags and attributes are stripped.
-- Roblox must permit every asset for this experience owner; this never changes security settings.
-- Model library dimensions must match the source bounding box. Existing source materials are preserved unless overridden.
-- This creates a NEW model and optionally changes Lighting. Undo removes the import and restores Lighting.
-- Test in a separate place first. This file has not been tested in your Studio or published for you.
local plan = ${lua(plan)}
local library = ${lua(library)}
local RunService = game:GetService("RunService")
assert(RunService:IsStudio() and not RunService:IsRunning(), "Run this installer in Studio Edit mode, not Play or Run.")
local AssetService = game:GetService("AssetService")
local History = game:GetService("ChangeHistoryService")
local Lighting = game:GetService("Lighting")
local CollectionService = game:GetService("CollectionService")
local recording = History:TryBeginRecording("SparkSceneImport", "Import Spark scene")
assert(recording, "Studio could not begin an undo recording. Finish other edits and retry.")
local root = Instance.new("Model")
root.Name = "Spark_" .. plan.name
local templates = {}
local loose = {}
local oldLighting = {ClockTime = Lighting.ClockTime, Brightness = Lighting.Brightness, Ambient = Lighting.Ambient}
local allowed = {Model=true, Folder=true, Part=true, WedgePart=true, CornerWedgePart=true, MeshPart=true, UnionOperation=true, TrussPart=true, SpecialMesh=true, BlockMesh=true, CylinderMesh=true, SurfaceAppearance=true, Decal=true, Texture=true, Attachment=true, Bone=true, PointLight=true, SpotLight=true, SurfaceLight=true, ParticleEmitter=true}
local instanceCount, partCount = 0, 0
local templateCount, templateParts = 0, 0
local function vector(value) return Vector3.new(value[1], value[2], value[3]) end
local function color(value) return Color3.fromRGB(value[1], value[2], value[3]) end
local function sanitize(model)
  -- The returned model stays outside the DataModel until all descendants are inspected.
  local descendants = model:GetDescendants()
  assert(#descendants <= 5000, "A source model exceeds Spark's 5,000-instance import limit.")
  for _, item in ipairs(descendants) do
    if not allowed[item.ClassName] then item:Destroy() end
  end
  local survivors = model:GetDescendants()
  table.insert(survivors, model)
  for _, item in ipairs(survivors) do
    for key in pairs(item:GetAttributes()) do item:SetAttribute(key, nil) end
    for _, tag in ipairs(CollectionService:GetTags(item)) do CollectionService:RemoveTag(item, tag) end
    if item:IsA("BasePart") then
      item.Anchored = true
      item.CanTouch = false
      item.CanQuery = true
      item.AssemblyLinearVelocity = Vector3.zero
      item.AssemblyAngularVelocity = Vector3.zero
    elseif item:IsA("ParticleEmitter") then
      item.Rate = math.min(item.Rate, 30)
      item.Lifetime = NumberRange.new(math.min(item.Lifetime.Min, 5), math.min(item.Lifetime.Max, 5))
      item.Speed = NumberRange.new(math.min(item.Speed.Min, 25), math.min(item.Speed.Max, 25))
    elseif item:IsA("Light") then
      item.Brightness = math.min(item.Brightness, 5)
      item.Range = math.min(item.Range, 30)
      item.Shadows = false
    end
  end
end
local function appearance(item, spec)
  if not spec then return end
  local targets = item:IsA("BasePart") and {item} or item:GetDescendants()
  local meshCount = 0
  for _, part in ipairs(targets) do
    if part:IsA("BasePart") then
      if spec.color then
        part.Color = color(spec.color)
        local existingSurface = part:FindFirstChildWhichIsA("SurfaceAppearance")
        if existingSurface then existingSurface.Color = color(spec.color) end
      end
      if spec.material then part.Material = Enum.Material[spec.material] end
      if spec.transparency ~= nil then part.Transparency = spec.transparency end
      if spec.reflectance ~= nil then part.Reflectance = spec.reflectance end
      if spec.pbr and part:IsA("MeshPart") then
        meshCount += 1
        local surface = part:FindFirstChildWhichIsA("SurfaceAppearance")
        if not surface then surface = Instance.new("SurfaceAppearance"); surface.Parent = part end
        if spec.color then surface.Color = color(spec.color) end
        if spec.pbr.colorMap then surface.ColorMap = "rbxassetid://" .. spec.pbr.colorMap end
        if spec.pbr.normalMap then surface.NormalMap = "rbxassetid://" .. spec.pbr.normalMap end
        if spec.pbr.roughnessMap then surface.RoughnessMap = "rbxassetid://" .. spec.pbr.roughnessMap end
        if spec.pbr.metalnessMap then surface.MetalnessMap = "rbxassetid://" .. spec.pbr.metalnessMap end
      end
    end
  end
  assert(not spec.pbr or meshCount > 0, "PBR override requires at least one MeshPart in the source asset.")
end
local ok, failure = xpcall(function()
  for id, asset in pairs(library) do
    local template
    if asset.kind == "mesh" then
      template = AssetService:CreateMeshPartAsync(Content.fromUri("rbxassetid://" .. asset.robloxId), {CollisionFidelity=Enum.CollisionFidelity.Hull, RenderFidelity=Enum.RenderFidelity.Automatic})
    else
      template = AssetService:LoadAssetAsync(tonumber(asset.robloxId))
    end
    assert(template, "Roblox returned no asset for " .. asset.name)
    table.insert(loose, template)
    template.Parent = nil
    sanitize(template)
    assert(asset.kind ~= "model" or template:IsA("Model"), "The referenced asset is not a Model.")
    local templateMembers = template:GetDescendants()
    table.insert(templateMembers, template)
    templateCount += #templateMembers
    for _, member in ipairs(templateMembers) do if member:IsA("BasePart") then templateParts += 1 end end
    assert(templateCount <= 5000 and templateParts <= 2000, "Source assets exceed Spark's combined 5,000-instance / 2,000-part staging budget.")
    template.Archivable = true
    for _, child in ipairs(template:GetDescendants()) do child.Archivable = true end
    templates[id] = template
  end
  for _, node in ipairs(plan.nodes) do
    local item
    local target = CFrame.new(vector(node.position)) * CFrame.fromOrientation(math.rad(node.rotation[1]), math.rad(node.rotation[2]), math.rad(node.rotation[3]))
    if node.assetId then
      local asset = library[node.assetId]
      item = templates[node.assetId]:Clone()
      table.insert(loose, item)
      if item:IsA("Model") then
        local _, bounds = item:GetBoundingBox()
        assert(bounds.X > 0 and bounds.Y > 0 and bounds.Z > 0, "Source model has no physical geometry: " .. asset.name)
        local measured = {bounds.X, bounds.Y, bounds.Z}
        for axis = 1, 3 do
          assert(math.abs(measured[axis] - asset.size[axis]) <= math.max(0.05, asset.size[axis] * 0.05), "Update library dimensions to the source bounding box for " .. asset.name)
        end
        item:ScaleTo(item:GetScale() * node.size[1] / bounds.X)
        local box = item:GetBoundingBox()
        item:PivotTo(target * box:Inverse() * item:GetPivot())
      else
        item.Size = vector(node.size)
        item.CFrame = target
      end
      appearance(item, asset.material)
    else
      item = Instance.new(node.primitive == "Wedge" and "WedgePart" or "Part")
      table.insert(loose, item)
      if node.primitive ~= "Wedge" then item.Shape = Enum.PartType[node.primitive] end
      item.Size = vector(node.size)
      item.CFrame = target
      item.Anchored = true
      item.CanTouch = false
      item.CanQuery = true
      item.CanCollide = true
    end
    item.Name = node.name
    appearance(item, node.material)
    item:SetAttribute("SparkNodeId", node.id)
    if node.assetId then
      local asset = library[node.assetId]
      item:SetAttribute("SparkLibraryAssetId", asset.id)
      item:SetAttribute("SparkRobloxAssetId", asset.robloxId)
      item:SetAttribute("SparkSourceUrl", asset.sourceUrl)
      item:SetAttribute("SparkRightsAttestation", asset.license)
    end
    local members = item:GetDescendants()
    table.insert(members, item)
    instanceCount += #members
    for _, member in ipairs(members) do if member:IsA("BasePart") then partCount += 1 end end
    assert(instanceCount <= 5000 and partCount <= 2000, "Scene exceeds Spark's 5,000-instance / 2,000-part safety budget.")
    item.Parent = root
  end
  root:SetAttribute("SparkSceneVersion", 1)
  root:SetAttribute("SparkArtDirection", plan.style)
  root.Parent = workspace
  if plan.lighting then
    Lighting.ClockTime = plan.lighting.clockTime
    Lighting.Brightness = plan.lighting.brightness
    Lighting.Ambient = color(plan.lighting.ambient)
  end
end, debug.traceback)
for _, template in pairs(templates) do template:Destroy() end
if not ok then
  root:Destroy()
  for _, item in ipairs(loose) do if item.Parent == nil then item:Destroy() end end
  Lighting.ClockTime = oldLighting.ClockTime
  Lighting.Brightness = oldLighting.Brightness
  Lighting.Ambient = oldLighting.Ambient
  History:FinishRecording(recording, Enum.FinishRecordingOperation.Cancel)
  error("Spark import rolled back. Check IDs, ownership, moderation, dimensions, and Studio asset permissions. " .. tostring(failure), 0)
end
History:FinishRecording(recording, Enum.FinishRecordingOperation.Commit)
game:GetService("Selection"):Set({root})
print("Spark imported " .. #plan.nodes .. " scene nodes. Review appearance, collisions, and performance before publishing.")
`;
}
