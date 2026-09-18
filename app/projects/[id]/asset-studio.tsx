"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Box, Check, ChevronDown, Download, Layers3, Loader2, Plus, RefreshCw, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { api } from "../../auth-form";
import { ROBLOX_MATERIALS, type Triple, type MaterialSpec as Material, type LibraryAsset, type ScenePlan } from "@/lib/spark/scenes";
import "./asset-studio.css";
import CreatorStore from "./creator-store";
import type {StoreModel} from "@/lib/spark/creator-store";

type SceneJob = { id: string; prompt: string; status: "queued" | "running" | "complete" | "failed"; plan: ScenePlan | null; error: string | null; created: number; updated: number };
type Quote = { model: string; label: string; maxCredits: number; estimatedCredits: number };
const example = "Create a detailed medieval blacksmith shop with weathered timber framing, stone foundation, tiled roof, forge, chimney, tools, barrels, signs and a furnished interior. Use a coherent warm, stylized medieval art style.";
const materials = ROBLOX_MATERIALS;
const maps = [["colorMap", "Color map"], ["normalMap", "Normal map"], ["roughnessMap", "Roughness map"], ["metalnessMap", "Metalness map"]] as const;
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Something went wrong. Refresh to check the saved status."; }
function numberList(values: Triple) { return values.map(value => Number(value.toFixed(2))).join(" × "); }
function downloadSource(filename: string, source: string) {
  const url = URL.createObjectURL(new Blob([source], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function AssetForm({ onSaved, projectId, selected }: { onSaved: (asset: LibraryAsset) => void; projectId: string; selected?: StoreModel | null }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [kind, setKind] = useState<"mesh" | "model">(selected ? "model" : "mesh");
  const submitting = useRef(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const form = new FormData(event.currentTarget);
    const value = (name: string) => String(form.get(name) || "").trim();
    const material: Material = {};
    if (value("material")) material.material = value("material") as Material["material"];
    if (value("color")) material.color = [1, 3, 5].map(index => parseInt(value("color").slice(index, index + 2), 16)) as Triple;
    if (value("transparency")) material.transparency = Number(value("transparency"));
    if (value("reflectance")) material.reflectance = Number(value("reflectance"));
    const pbr: NonNullable<Material["pbr"]> = {};
    if (kind === "mesh") for (const [key] of maps) if (value(key)) pbr[key] = value(key);
    if (Object.keys(pbr).length) material.pbr = pbr;
    submitting.current = true; setBusy(true); setError("");
    try {
      const result = await api(`projects/${projectId}/assets`, "POST", {
        name: value("name"), kind, robloxId: value("robloxId"), sourceUrl: value("sourceUrl"), license: value("license"),
        tags: value("tags").split(",").map(tag => tag.trim()).filter(Boolean),
        size: ["width", "height", "depth"].map(axis => Number(value(axis))),
        ...(Object.keys(material).length ? { material } : {}),
      });
      onSaved(result.asset);
    } catch (failure) { setError(errorMessage(failure)); }
    finally { submitting.current = false; setBusy(false); }
  }
  return <form className="asset-form" onSubmit={save}>
    <div className="asset-form-pair">
      <label>Asset name<input name="name" defaultValue={selected?.name.slice(0,80)} required maxLength={80} placeholder="Weathered oak barrel" autoFocus /></label>
      <label>Asset type<select name="kind" value={kind} onChange={event => setKind(event.target.value as "mesh" | "model")}><option value="mesh">Mesh asset → MeshPart</option><option value="model">Model asset → multi-part model</option></select></label>
    </div>
    <label>Roblox {kind === "mesh" ? "mesh" : "model"} asset ID<input name="robloxId" defaultValue={selected?.id} required inputMode="numeric" pattern="[1-9][0-9]{0,15}" maxLength={16} placeholder="Enter an existing asset ID" aria-describedby="asset-id-help" /></label>
    <p id="asset-id-help" className="asset-help">Use the {kind === "mesh" ? "mesh content ID, not a catalog model ID" : "model asset ID, not an individual mesh content ID"}. Your Studio account and experience must have permission to load it. Spark does not verify ownership or availability here.</p>
    <fieldset><legend>Original dimensions in studs</legend><div className="asset-form-triple">{["width", "height", "depth"].map(axis => <label key={axis}>{axis}<input name={axis} required type="number" min="0.05" max="2048" step="any" placeholder="4" /></label>)}</div><p className="asset-help">Measure the asset in Studio. Accurate bounds help the planner place and scale it. Multi-part models are scaled uniformly to preserve their proportions.</p></fieldset>
    <label>Source link <span>(optional)</span><input name="sourceUrl" defaultValue={selected?.url} type="url" pattern="https://.*" maxLength={1000} placeholder="https://create.roblox.com/…" /></label>
    <label>License / permission to use<input name="license" required minLength={3} maxLength={500} placeholder="I created this asset, or specify its license and permission" /></label>
    <label>Style and search tags <span>(up to 12 tags, 40 characters each; optional)</span><input name="tags" maxLength={500} placeholder="medieval, stylized, weathered wood, storage" /></label>
    <details className="asset-advanced"><summary>Material & texture overrides <ChevronDown size={15} aria-hidden="true" /></summary>
      <p className="asset-help">Leave these empty to preserve the asset’s appearance. Overrides affect the asset’s visual parts. Use a separate library entry for a different finish.</p>
      <div className="asset-form-pair"><label>Roblox material<select name="material" defaultValue=""><option value="">Keep original</option>{materials.map(material => <option key={material}>{material}</option>)}</select></label><label>Color tint <span>(optional)</span><input name="color" pattern="#[0-9a-fA-F]{6}" maxLength={7} placeholder="#B38A62" /></label></div>
      <div className="asset-form-pair"><label>Transparency<input name="transparency" type="number" min="0" max="1" step="0.01" placeholder="Keep original" /></label><label>Reflectance<input name="reflectance" type="number" min="0" max="1" step="0.01" placeholder="Keep original" /></label></div>
      {kind === "mesh" ? <><p className="asset-help">PBR maps must be existing Roblox image asset IDs. The mesh needs compatible UVs. Use a tangent-space OpenGL normal map; maps do not add geometry.</p><div className="asset-form-pair">{maps.map(([key, label]) => <label key={key}>{label}<input name={key} inputMode="numeric" pattern="[1-9][0-9]*" maxLength={20} placeholder="Image asset ID" /></label>)}</div></> : <p className="asset-help">For multi-mesh models, configure each mesh’s UVs and PBR materials in Studio before registering the model. A single texture set should not be applied across unrelated meshes.</p>}
    </details>
    <label className="asset-attestation"><input type="checkbox" required /><span>I have the rights to use this asset and its textures in this project. A source link alone is not a license.</span></label>
    {error && <p className="error" role="alert">{error}</p>}
    <button className="button" disabled={busy}>{busy ? <Loader2 size={16} className="asset-spin" /> : <Plus size={16} />} {busy ? "Saving asset…" : "Add to project library"}</button>
  </form>;
}

function PlanDetails({ job, assets }: { job: SceneJob; assets: LibraryAsset[] }) {
  const plan = job.plan;
  if (!plan) return null;
  const library = new Map(assets.map(asset => [asset.id, asset]));
  return <div className="scene-plan">
    <div className="scene-style"><span>ART DIRECTION</span><p>{plan.style}</p></div>
    {plan.missingAssets.length > 0 && <section className="scene-missing" aria-label="Assets needed"><h4>Assets needed before export</h4><p>Spark has left these unresolved instead of substituting blocky placeholders. Add suitable assets to the library, then create a new plan.</p><ul>{plan.missingAssets.map((asset, index) => <li key={index}><strong>{asset.name}</strong><span>{asset.description}</span></li>)}</ul></section>}
    <details className="scene-nodes"><summary>{plan.nodes.length} placed {plan.nodes.length === 1 ? "object" : "objects"}<ChevronDown size={15} aria-hidden="true" /></summary><div className="scene-table-scroll"><table><caption className="sr-only">Planned objects and transforms. Position and size are in studs; rotation is in degrees.</caption><thead><tr><th>Object / source</th><th>Position · X Y Z</th><th>Rotation · degrees</th><th>Size · studs</th></tr></thead><tbody>{plan.nodes.map(node => <tr key={node.id}><td><strong>{node.name}</strong><small>{node.assetId ? library.get(node.assetId)?.name || "Saved library snapshot" : `${node.primitive || "Part"} primitive`}</small></td><td>{node.position.join(", ")}</td><td>{node.rotation.join(", ")}</td><td>{numberList(node.size)}</td></tr>)}</tbody></table></div></details>
    {plan.lighting && <p className="asset-help">Lighting: {plan.lighting.clockTime.toFixed(1)} h · Brightness {plan.lighting.brightness} · Ambient RGB {plan.lighting.ambient.join(", ")}. Review scene-wide lighting changes before import.</p>}
  </div>;
}

export default function AssetStudio({ projectId, initialPrompt = "" }: { projectId: string; initialPrompt?: string }) {
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [jobs, setJobs] = useState<SceneJob[]>([]);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [prompt, setPrompt] = useState(initialPrompt);
  const [addOpen, setAddOpen] = useState(false);
  const [storeSelection,setStoreSelection]=useState<StoreModel|null>(null);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [working, setWorking] = useState("");
  const [removeId, setRemoveId] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const submitting = useRef(false);
  const mounted = useRef(true);
  const path = `projects/${projectId}`;
  const load = useCallback(async () => {
    const [library, scenes] = await Promise.all([api(`${path}/assets`), api(`${path}/scene-jobs`)]);
    if (mounted.current) { setAssets(library.assets); setJobs(scenes.jobs); setAiConfigured(scenes.aiConfigured); }
  }, [path]);
  useEffect(() => {
    mounted.current = true;
    load().catch(failure => { if (mounted.current) setError(errorMessage(failure)); }).finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, [load]);
  const runningIds = jobs.filter(job => job.status === "running").map(job => job.id).sort().join(",");
  useEffect(() => {
    if (!runningIds) return;
    const deadline = Date.now() + 6 * 60_000;
    let refreshing = false;
    const timer = setInterval(async () => {
      if (Date.now() > deadline) { clearInterval(timer); if (mounted.current) setNotice("Automatic status checks have paused. Refresh to check the saved job; do not start a duplicate run while it is running."); return; }
      if (refreshing) return;
      refreshing = true;
      try { const result = await api(`${path}/scene-jobs`); if (mounted.current) setJobs(result.jobs); }
      catch { /* The explicit refresh action surfaces connection errors without interrupting a paid run. */ }
      finally { refreshing = false; }
    }, 5000);
    return () => clearInterval(timer);
  }, [runningIds, path]);
  function replaceJob(job: SceneJob) { setJobs(current => [job, ...current.filter(item => item.id !== job.id)]); }
  async function action(key: string, task: () => Promise<void>) {
    if (submitting.current) return;
    submitting.current = true; setWorking(key); setError(""); setNotice("");
    try { await task(); } catch (failure) { if (mounted.current) setError(errorMessage(failure)); }
    finally { submitting.current = false; if (mounted.current) setWorking(""); }
  }
  async function estimate(job: SceneJob) {
    const quote = await api(`${path}/scene-jobs/${job.id}/estimate`, "POST", {});
    if (mounted.current) setQuotes(current => ({ ...current, [job.id]: quote }));
  }
  function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const content = prompt.trim();
    if (!content) return;
    void action("create", async () => {
      const result = await api(`${path}/scene-jobs`, "POST", { id: crypto.randomUUID(), prompt: content });
      if (mounted.current) { replaceJob(result.job); setPrompt(""); setExpanded(current => ({ ...current, [result.job.id]: true })); }
      if (aiConfigured) await estimate(result.job);
    });
  }
  function run(job: SceneJob) {
    const quote = quotes[job.id];
    if (!quote || runningIds) return;
    void action(`run:${job.id}`, async () => {
      replaceJob({ ...job, status: "running" });
      try {
        const result = await api(`${path}/scene-jobs/${job.id}/run`, "POST", { model: quote.model, maxCredits: quote.maxCredits });
        if (mounted.current) {
          replaceJob(result.job);
          setQuotes(current => { const next = { ...current }; delete next[job.id]; return next; });
          setNotice(typeof result.credits === "number" ? `Scene plan saved. Charged ${result.credits.toLocaleString()} Spark Credits; unused reserved credits were returned.` : "Your saved scene plan is ready. No duplicate planning run was started.");
        }
      }
      catch (failure) {
        setQuotes(current => { const next = { ...current }; delete next[job.id]; return next; });
        try { await load(); } catch { setNotice("Could not refresh the saved status. Check again before starting another run."); }
        throw failure;
      }
    });
  }
  return <section className="asset-studio" aria-label="Asset Studio">
    <div className="asset-studio-heading"><div><span className="asset-kicker"><Layers3 size={14} aria-hidden="true" /> PROJECT ASSET STUDIO</span><h2>Build with real assets.</h2><p>Find free Roblox models or use your own assets. Import a model directly, or add it to your library for scene planning.</p></div><button className="asset-secondary" disabled={!!working || loading} onClick={() => void action("refresh", load)}><RefreshCw size={15} className={working === "refresh" ? "asset-spin" : ""} /> Refresh</button></div>
    <div className="asset-pipeline" aria-label="Workflow"><span><b>1</b> Find assets</span><ArrowRight size={14} aria-hidden="true" /><span><b>2</b> Plan the scene</span><ArrowRight size={14} aria-hidden="true" /><span><b>3</b> Review & import</span></div>
    {error && <div className="error asset-feedback" role="alert">{error}</div>}
    {notice && <p className="notice asset-feedback" role="status">{notice}</p>}
    <CreatorStore projectId={projectId} onChoose={model=>{setStoreSelection(model);setAddOpen(true);}} />
    {loading ? <p className="asset-loading" role="status"><Loader2 size={20} className="asset-spin" /> Loading your project library…</p> : <div className="asset-workbench">
      <aside className="asset-library" aria-labelledby="asset-library-title"><div className="asset-section-heading"><div><h3 id="asset-library-title">Asset library <span>{assets.length}</span></h3><p>Reusable across plans in this project.</p></div><button className="asset-icon-button" aria-label="Add asset to library" title="Add asset" onClick={() => {setStoreSelection(null);setAddOpen(true);}}><Plus size={19} /></button></div>
        {!assets.length ? <div className="asset-empty"><Box size={34} strokeWidth={1.3} aria-hidden="true" /><h4>Your asset collection starts here</h4><p>Find a free model above, or add one you already own. Library references let Spark plan its placement and scale.</p><button className="asset-secondary" onClick={() => {setStoreSelection(null);setAddOpen(true);}}><Plus size={15} /> Add first asset</button></div> : <ul className="asset-list">{assets.map(asset => <li className="asset-card" key={asset.id}><div className="asset-card-title"><span className="asset-box-icon"><Box size={19} aria-hidden="true" /></span><div><h4>{asset.name}</h4><small>{asset.kind === "mesh" ? "MeshPart" : "Multi-part model"} · {asset.robloxId}</small></div></div><p className="asset-dimensions">{numberList(asset.size)} studs {asset.material?.pbr ? "· PBR maps" : ""}</p>{asset.tags.length > 0 && <div className="asset-tags">{asset.tags.map((tag, index) => <span key={index}>{tag}</span>)}</div>}<details className="asset-provenance"><summary>Source & permissions</summary><p>{asset.license}</p>{asset.sourceUrl && <a href={asset.sourceUrl} target="_blank" rel="noopener noreferrer">View source ↗</a>}<p>Declared by you; not verified by Spark.</p></details>{removeId === asset.id ? <div className="asset-remove-confirm"><p>Remove this library entry? Completed plans keep their saved asset reference. The Roblox asset itself is not deleted; new plans will no longer select this entry.</p><div><button disabled={!!working} onClick={() => void action(`remove:${asset.id}`, async () => { await api(`${path}/assets/${asset.id}`, "DELETE"); setAssets(current => current.filter(item => item.id !== asset.id)); setRemoveId(""); })}>Confirm remove</button><button disabled={!!working} onClick={() => setRemoveId("")}>Cancel</button></div></div> : <button className="asset-remove" onClick={() => setRemoveId(asset.id)}><Trash2 size={12} aria-hidden="true" /> Remove entry</button>}</li>)}</ul>}
        <div className="asset-library-note"><ShieldCheck size={16} aria-hidden="true" /><p>Only registered asset IDs are used. No automatic purchases, third-party generation, or asset uploads.</p></div>
      </aside>
      <div className="asset-planning"><section className="scene-composer" aria-labelledby="scene-prompt-title"><span className="asset-kicker"><Sparkles size={14} aria-hidden="true" /> LIBRARY-AWARE PLANNING</span><h3 id="scene-prompt-title">Describe the scene, not every polygon.</h3><p>Spark plans the layout, chooses library assets, and records missing pieces. Primitive geometry is used for suitable structural elements.</p><form onSubmit={createPlan}><label className="sr-only" htmlFor="scene-prompt">Scene brief</label><textarea id="scene-prompt" value={prompt} onChange={event => setPrompt(event.target.value)} maxLength={8000} required placeholder="Describe your environment, art style, scale, and must-have details…" rows={5} /><div className="scene-composer-actions"><button type="button" className="scene-example" onClick={() => setPrompt(example)}>Try a medieval blacksmith shop ↗</button><button className="button" disabled={!!working || !prompt.trim()}>{working === "create" ? <Loader2 size={16} className="asset-spin" /> : <Plus size={16} />} Save & estimate</button></div><p className="asset-help">Saving and estimating are free. Review the maximum Spark Credits before running the planner. This does not generate new 3D meshes.</p></form>{!aiConfigured && <p className="notice">AI planning is not configured yet. You can still register assets and save briefs; the owner must configure OpenAI before running a plan.</p>}</section>
        <section className="scene-history" aria-labelledby="scene-history-title"><div className="asset-section-heading"><div><h3 id="scene-history-title">Saved scene plans <span>{jobs.length}</span></h3><p>Each brief keeps its own plan and status.</p></div></div>{!jobs.length ? <div className="scene-history-empty"><Layers3 size={23} aria-hidden="true" /><p>Your first plan will appear here. Start with a small scene and a few well-chosen assets.</p></div> : jobs.map(job => {
          const quote = quotes[job.id];
          const isRunning = job.status === "running";
          const missing = job.plan?.missingAssets.length || 0;
          const canExport = job.status === "complete" && !!job.plan && missing === 0;
          return <article className="scene-job" key={job.id}><div className="scene-job-heading"><div><h4>{job.plan?.name || "Scene brief"}</h4><span className={`scene-status scene-status-${job.status}`}>{isRunning ? <Loader2 size={12} className="asset-spin" /> : job.status === "complete" ? <Check size={12} /> : null}{job.status === "complete" ? missing ? "Needs assets" : "Plan ready" : job.status === "queued" ? "Ready to plan" : job.status === "failed" ? "Needs attention" : "Planning"}</span></div><button className="asset-icon-button" aria-label={`${expanded[job.id] ? "Collapse" : "Expand"} scene plan`} aria-expanded={!!expanded[job.id]} onClick={() => setExpanded(current => ({ ...current, [job.id]: !current[job.id] }))}><ChevronDown size={18} style={{ transform: expanded[job.id] ? "rotate(180deg)" : undefined }} /></button></div><p className={`scene-brief${expanded[job.id] ? " scene-brief-expanded" : ""}`}>{job.prompt}</p>
            {isRunning && <p className="asset-help" role="status">Planning with your registered assets. Status is saved on the server; returning here will reload it. No automatic paid retries.</p>}
            {job.error && <p className="error" role="alert">{job.error}</p>}
            {expanded[job.id] && <PlanDetails job={job} assets={assets} />}
            {quote && (job.status === "queued" || job.status === "failed") && <div className="scene-quote"><div><strong>About {quote.estimatedCredits.toLocaleString()} Spark Credits</strong><span>Maximum {quote.maxCredits.toLocaleString()} · {quote.label}</span></div><p>Only actual usage is charged. Unused reserved credits are returned. Running plans are never retried automatically.</p><button className="button" disabled={!!working || !!runningIds || !aiConfigured} onClick={() => run(job)}><Sparkles size={15} /> Run · up to {quote.maxCredits.toLocaleString()} credits</button></div>}
            <div className="scene-job-actions">{!quote && (job.status === "queued" || job.status === "failed") && <button className="asset-secondary" disabled={!!working || !aiConfigured || !!runningIds} onClick={() => void action(`estimate:${job.id}`, () => estimate(job))}>{working === `estimate:${job.id}` ? <Loader2 size={14} className="asset-spin" /> : null}Review credit estimate</button>}{job.status === "complete" && <button className="asset-secondary" disabled={!canExport || !!working} title={missing ? "Add missing assets and create a new plan before export" : "Download a Studio installer to review"} onClick={() => void action(`export:${job.id}`, async () => { const result = await api(`${path}/scene-jobs/${job.id}/export`); downloadSource(result.filename, result.source); setNotice("Installer downloaded. Review the code, then run it in Roblox Studio’s Command Bar in Edit mode on a backed-up place. No asset has been installed or tested by Spark."); })}><Download size={15} /> {working === `export:${job.id}` ? "Preparing installer…" : "Download Studio installer"}</button>}{(job.status === "complete" || job.status === "failed") && <button className="scene-example" onClick={() => { setPrompt(job.prompt); document.getElementById("scene-prompt")?.focus(); }}>Use brief for a new plan</button>}</div>
          </article>;
        })}</section>
        <section className="scene-import-note"><ShieldCheck size={19} aria-hidden="true" /><div><h3>You stay in control in Studio.</h3><p>The download is an inspectable Luau installer, not a live Studio connection. Review it, back up your place, and run it in the Command Bar in Edit mode. Check permissions, materials, collision, scale, and device performance before publishing. Spark has not tested your scene in Studio.</p></div></section>
      </div>
    </div>}
    <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent className="asset-dialog"><DialogTitle>Add a reusable asset</DialogTitle><DialogDescription>Register an existing Roblox asset for this project. This saves a reference; it does not upload, purchase, or generate an asset.</DialogDescription><AssetForm selected={storeSelection} projectId={projectId} onSaved={asset => { setAssets(current => [asset, ...current]); setAddOpen(false); setNotice(`${asset.name} added. New plans can use it; existing plans are unchanged.`); }} /></DialogContent></Dialog>
  </section>;
}
