export type SparkFile = {name:string; title?:string; content:string; kind:"script"|"model"; location:string; source:string; scriptType?:string};
export function fileTitle(file:SparkFile, context=""):string {
  if(file.title?.trim()) return file.title.trim().slice(0,90);
  const stem=file.name.replace(/\.(?:server\.|client\.)?(?:luau?|rbxmx)$/i,"");
  if(/^SparkScript\d*$/i.test(stem)) {
    const description=context.split(/```/)[0].replace(/[#*`]/g,"").replace(/\s+/g," ").trim();
    if(description) return description.length>80?description.slice(0,77)+"…":description;
    return "Roblox script";
  }
  return stem.replace(/([a-z0-9])([A-Z])/g,"$1 $2").replace(/([A-Z])([A-Z][a-z])/g,"$1 $2").replace(/[_-]+/g," ").replace(/\s+/g," ").trim();
}
const xml = (value:string) => value.replace(/[<>&"']/g, c => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&apos;"}[c]!)).replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "");
const filename = (value:string) => value.replace(/[^a-zA-Z0-9_-]/g,"_").slice(0,70) || "SparkAsset";
function vector(value:unknown, min:number, max:number):number[] {
  if(!Array.isArray(value)||value.length!==3||value.some(n=>typeof n!=="number"||!Number.isFinite(n)||n<min||n>max)) throw new Error("Model has an invalid size, position, or color. Ask Spark to regenerate it.");
  return value;
}
const vec = (name:string,v:number[]) => `<Vector3 name="${name}"><X>${v[0]}</X><Y>${v[1]}</Y><Z>${v[2]}</Z></Vector3>`;
const document = (item:string) => `<?xml version="1.0" encoding="utf-8"?><roblox version="4"><External>null</External><External>nil</External>${item}</roblox>`;
export function modelFile(source:string):SparkFile {
  const value=JSON.parse(source);
  if(!value || typeof value.name!=="string" || !value.name.trim() || value.name.length>80 || !Array.isArray(value.parts)||!value.parts.length||value.parts.length>50) throw new Error("Model needs a name and 1–50 parts. Ask Spark to regenerate it.");
  const parts=value.parts.map((p:any,i:number)=>{
    if(!p||!["Block","Ball","Cylinder","Wedge"].includes(p.shape)) throw new Error("Model contains an unsupported shape.");
    if(Object.keys(p).some(key=>!["name","shape","size","position","color"].includes(key))) throw new Error("Model contains unsupported properties. Ask Spark to use supported parts.");
    const size=vector(p.size,.05,2048),position=vector(p.position,-10000,10000),color=vector(p.color,0,255);
    const name=typeof p.name==="string"?p.name.slice(0,80):`Part${i+1}`;
    return `<Item class="${p.shape==="Wedge"?"WedgePart":"Part"}" referent="RBX${i+1}"><Properties><string name="Name">${xml(name)}</string><bool name="Anchored">true</bool><bool name="CanCollide">true</bool>${vec("size",size)}<CoordinateFrame name="CFrame"><X>${position[0]}</X><Y>${position[1]}</Y><Z>${position[2]}</Z><R00>1</R00><R01>0</R01><R02>0</R02><R10>0</R10><R11>1</R11><R12>0</R12><R20>0</R20><R21>0</R21><R22>1</R22></CoordinateFrame><Color3uint8 name="Color3uint8">${(255*16777216)+(Math.round(color[0])*65536)+(Math.round(color[1])*256)+Math.round(color[2])}</Color3uint8>${p.shape==="Wedge"?"":`<token name="shape">${{Ball:0,Block:1,Cylinder:2}[p.shape as "Ball"|"Block"|"Cylinder"]}</token>`}</Properties></Item>`;
  }).join("");
  return {name:filename(value.name)+".rbxmx",title:typeof value.title==="string"?value.title.slice(0,90):undefined,kind:"model",location:"Workspace",source,content:document(`<Item class="Model" referent="RBX0"><Properties><string name="Name">${xml(value.name)}</string></Properties>${parts}</Item>`)};
}
export function scriptFile(source:string,index=1):SparkFile {
  const scriptType=source.match(/^--\s*Spark type:\s*(Script|LocalScript|ModuleScript)\s*$/m)?.[1] || "Script";
  const supplied=source.match(/^--\s*Spark file:\s*(.+)$/m)?.[1]?.trim().replace(/\.(?:server\.|client\.)?lua[u]?$/i,"");
  const suffix=scriptType==="LocalScript"?".client.luau":scriptType==="ModuleScript"?".luau":".server.luau";
  return {name:filename(supplied||`SparkScript${index}`)+suffix,title:source.match(/^--\s*Spark title:\s*(.+)$/m)?.[1]?.trim().slice(0,90),kind:"script",scriptType,source,content:source,location:source.match(/^--\s*Spark location:\s*(.+)$/m)?.[1]?.trim() || "See the response for placement instructions"};
}
export function scriptModel(file:SparkFile):string {
  if(file.kind!=="script" || !["Script","LocalScript","ModuleScript"].includes(file.scriptType||"")) throw new Error("Not a script file");
  return document(`<Item class="${file.scriptType}" referent="RBX0"><Properties><string name="Name">${xml(file.name.replace(/\.(?:server\.|client\.)?luau$/,""))}</string><ProtectedString name="Source">${xml(file.source)}</ProtectedString>${file.scriptType==="ModuleScript"?"":'<bool name="Disabled">true</bool>'}</Properties></Item>`);
}
// Recover model payloads from older replies without executing or trusting them.
export function normalizeArtifactMarkdown(text:string):string {
  const recover=(chunk:string):string=>{
    let out="",start=0;
    for(let i=0;i<chunk.length;i++) {
      if(chunk[i]!=="{") continue;
      let depth=0,quoted=false,escaped=false,end=-1;
      for(let j=i;j<chunk.length;j++) {
        const c=chunk[j];
        if(quoted){if(escaped)escaped=false;else if(c==="\\")escaped=true;else if(c==='"')quoted=false;continue;}
        if(c==='"')quoted=true;
        else if(c==="{")depth++;
        else if(c==="}"&&--depth===0){end=j+1;break;}
      }
      if(end<0) break;
      const raw=chunk.slice(i,end);
      try { const value=JSON.parse(raw); if(value&&typeof value.name==="string"&&Array.isArray(value.parts)) {
        out+=chunk.slice(start,i)+"\n\n```spark-model\n"+raw+"\n```\n\n";start=end;i=end-1;
      }} catch { /* Ordinary prose is preserved. */ }
    }
    return out+chunk.slice(start);
  };
  return text.split(/(```[^\n]*\n[\s\S]*?```)/g).map(chunk=>{
    if(!chunk.startsWith("```")) return recover(chunk);
    const match=chunk.match(/^```(?:json)?\s*\n([\s\S]*?)```$/i);
    if(!match)return chunk;
    const recovered=recover(match[1]);return recovered.includes("```spark-model")?recovered:chunk;
  }).join("");
}
export function extractFiles(text:string):SparkFile[] {
  if(text.includes("Response reached its length limit") || text.includes("This response is incomplete")) return [];
  const files:SparkFile[]=[];
  for(const match of normalizeArtifactMarkdown(text).matchAll(/```(luau|lua|spark-model)\s*\n([\s\S]*?)```/g)) {
    try {files.push(match[1]==="spark-model"?modelFile(match[2]):scriptFile(match[2],files.length+1));} catch { /* Invalid models remain visible with a regeneration instruction. */ }
  }
  return files;
}
export const artifactInstructions = `When asked to generate scripts, supply complete usable files, not only pseudocode. Each luau fence must start with these metadata comments: -- Spark file: DescriptiveName.server.luau (or .client.luau or .luau), -- Spark title: short friendly description of what the file does, -- Spark type: Script (or LocalScript or ModuleScript), -- Spark location: exact Studio Explorer parent path. Use separate blocks for separate files. Downloads are created by Spark from these blocks. Include dependencies, manual import and testing instructions. Imported runnable scripts are disabled by default; tell the user to review the source, place each script correctly, then enable it. Do not claim snippets are complete systems.
For requested physical models, props, buildings or obstacle layouts, provide a fenced spark-model block containing strict JSON: {"name":"ModelName","parts":[{"name":"Base","shape":"Block","size":[10,1,10],"position":[0,0,0],"color":[120,120,120]}]}. Supported shapes: Block, Ball, Cylinder, Wedge. 1–50 anchored collidable parts, sizes .05–2048 studs, positions -10000–10000 studs, RGB colors 0–255. Only axis-aligned parts are supported; do not add rotation, mesh assets, scripts or extra properties to this format. Spark validates and exports this data to a .rbxmx file. Tell the user to right-click Workspace in Studio Explorer and use Insert from File / Import Roblox Model, then select the downloaded file. Explain that these are part-based models, not sculpted meshes, rigged characters, or images. For larger worlds, deliver a small complete first module and offer to extend it. Never claim a file was tested in Studio. Do not generate images or thumbnails.`;
