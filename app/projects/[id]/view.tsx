"use client";
import { useEffect, useRef, useState } from "react";
import { Code2, ArrowUp, Plus, Layers3, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../auth-form";
import ProjectActions from "../../project-actions";
import AssetStudio from "./asset-studio";
import ModelChoices from "./model-options";
import {readModelOptions} from "@/lib/spark/model-options";
import { shouldUseAssetStudio } from "@/lib/spark/scene-intent";
import { readIdea, clearIdea } from "@/lib/spark/draft";
import { extractFiles, modelFile, scriptFile, scriptModel, normalizeArtifactMarkdown, fileTitle, type SparkFile } from "@/lib/spark/artifacts";
function downloadFile(name:string, content:string) {
  const url=URL.createObjectURL(new Blob([content],{type:"text/plain;charset=utf-8"}));
  const link=document.createElement("a"); link.href=url; link.download=name; link.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function FileCard({file}:{file:SparkFile}) {
  const name=file.kind==="model"?file.name:file.name.replace(/\.luau$/,".rbxmx");
  return <section className="code-block" style={{flexShrink:0}}><header style={{flexWrap:"wrap",gap:12}}><div style={{minWidth:0,flex:"1 1 180px"}}><strong style={{overflowWrap:"anywhere",fontSize:15}}>{fileTitle(file)}</strong><div className="muted" style={{fontSize:11,overflowWrap:"anywhere",marginTop:4}}>{name}</div></div><button className="button" onClick={()=>downloadFile(name,file.kind==="model"?file.content:scriptModel(file))}>Download for Roblox</button></header><div style={{padding:"12px 16px"}}><p><strong>Put it in:</strong> {file.location}</p><ol><li>Download the file above.</li><li>In Roblox Studio’s Explorer, right-click {file.kind==="model"?"Workspace":"the location above"} → Insert from File / Import Roblox Model.</li><li>{file.kind==="model"?"Choose the file, then press Play to try the build.":"Choose the file. Review the code, then turn off Disabled in Properties to enable it (ModuleScripts run when required)."}</li></ol>{file.kind==="script"&&<details open><summary>Code & source download</summary><button onClick={()=>downloadFile(file.name,file.source)}>Download .luau source</button><Code code={file.source} downloadable={false}/></details>}</div></section>;
}
function ModelCard({source}:{source:string}) {
  let file: SparkFile;
  try {file=modelFile(source);} catch {return <p className="error">This model could not be exported. Ask Spark to regenerate a complete model with supported parts.</p>;}
  return <FileCard file={file}/>;
}
const prompts = [
  "Help me plan an obby.",
  "Create a checkpoint system.",
  "Help me fix a Luau script.",
  "Design a round-based survival game.",
];
function Code({
  code,
  language = "luau",
  downloadable = true,
}: {
  code: string;
  language?: string;
  downloadable?: boolean;
}) {
  const [status, setStatus] = useState("Copy");
  return (
    <section className="code-block">
      <header>
        <span>{language}</span>
        {downloadable && ["luau","lua"].includes(language) && <button onClick={()=>{const file=scriptFile(code);downloadFile(file.name,file.content);}}>Download .luau</button>}
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              setStatus("Copied");
            } catch {
              setStatus("Select code to copy");
            }
            setTimeout(() => setStatus("Copy"), 2500);
          }}
        >
          {status}
        </button>
      </header>
      <pre tabIndex={0}>
        <code>{code}</code>
      </pre>
    </section>
  );
}
function Markdown({ text }: { text: string }) {
  const complete=!text.includes("Response reached its length limit")&&!text.includes("This response is incomplete");
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ children, className, node, ...props }) => {
            const content = String(children);
            if(className === "language-spark-model") return complete ? <ModelCard source={content}/> : <p className="notice">The model is incomplete. Ask Spark to regenerate a smaller complete model before downloading.</p>;
            if(complete && ["language-luau","language-lua"].includes(className||"")) return <FileCard file={scriptFile(content)}/>;
            return className?.startsWith("language-") ||
              content.includes("\n") ? (
              <Code
                language={className?.replace("language-", "") || "code"}
                code={content.replace(/\n$/, "")}
                downloadable={complete}
              />
            ) : (
              <code {...props}>{children}</code>
            );
          },
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
          ),
          img: () => null,
        }}
      >
        {normalizeArtifactMarkdown(text)}
      </ReactMarkdown>
    </div>
  );
}
export default function Workspace({ id }: { id: string }) {
  const [data, setData] = useState<any>(null),
    [projects, setProjects] = useState<any[]>([]),
    [draft, setDraft] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [takingLonger, setTakingLonger] = useState(false),
    [quote, setQuote] = useState<any>(null),
    [quoteError, setQuoteError] = useState(""),
    [scriptsOpen, setScriptsOpen] = useState(false),
    [assetsOpen, setAssetsOpen] = useState(false),
    [assetPrompt, setAssetPrompt] = useState(""),
    [retry, setRetry] = useState<any>(null);
  const sending = useRef(false),
    end = useRef<HTMLDivElement>(null);
  const assetBuild = shouldUseAssetStudio(draft.trim());
  function openAssetStudio() {
    setAssetPrompt(assetBuild ? draft.trim() : "");
    setAssetsOpen(true);
  }
  useEffect(() => {
    let cancelled=false;
    setQuote(null);
    setQuoteError("");
    if (!draft.trim() || assetBuild) return;
    const content=draft.trim();
    const timer=setTimeout(() => {
      api("projects/"+id+"/estimate","POST",{content,requestId:retry?.content===content?retry.requestId:undefined}).then(result => {
        if(!cancelled) setQuote({...result,content});
      }).catch(e => { if(!cancelled) setQuoteError(e.message); });
    },400);
    return () => {cancelled=true;clearTimeout(timer);};
  },[draft,id,data?.messages?.length,retry?.requestId,assetBuild]);
  useEffect(() => {
    setTakingLonger(false);
    if (!busy) return;
    const timer = setTimeout(() => setTakingLonger(true), 15000);
    return () => clearTimeout(timer);
  }, [busy]);
  async function load() {
    const result = await api("projects/" + id);
    setData(result);
    return result;
  }
  useEffect(() => {
    const idea = readIdea();
    if (idea?.projectId === id) setDraft(idea.content);
    Promise.all([
      load(),
      api("projects").then((r) => setProjects(r.projects)),
    ]).catch((e) => setError(e.message));
  }, [id]);
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [data?.messages?.length, busy]);
  function editFailed(request:any) {
    setRetry(request);setDraft(request.content);setError("");
    document.getElementById("message")?.focus();
  }
  async function send() {
    if (sending.current) return;
    const content = draft.trim();
    const findingModels=shouldUseAssetStudio(content);
    const retrying = retry?.content===content ? retry : null;
    if (!content) return;
    if (!findingModels && (!quote || quote.content!==content)) {
      try {
        const result=await api("projects/"+id+"/estimate","POST",{content,requestId:retrying?.requestId});
        setQuote({...result,content});
        setRetry(retrying || {content,requestId:crypto.randomUUID()});
        setError("Review the credit estimate below, then press Send.");
      } catch(e:any) {setError(e.message);}
      return;
    }
    sending.current = true;
    setBusy(true);
    setError("");
    const request = retrying || { content, requestId: crypto.randomUUID() };
    setRetry(request);
    setDraft("");
    setData((current: any) => current && ({...current, messages: current.messages.some((m: any) => m.id === request.requestId) ? current.messages : [...current.messages, {id: request.requestId, role: "user", content}]}));
    try {
      if(findingModels) await api("projects/"+id+"/model-options","POST",request);
      else await api("projects/" + id + "/messages", "POST", {...request,model:quote.model,maxCredits:quote.maxCredits});
      setRetry(null);
    } catch (e: any) {
      setError(e.message);
      setDraft(current => current || content);
      if(e.code==="QUOTE_CHANGED") setQuote(null);
      if (
        ![
          "AI_SETUP_REQUIRED",
          "INVALID_CREDENTIALS",
          "NO_CREDITS",
          "AI_CONFIGURATION",
          "DAILY_LIMIT",
          "RETRY_LIMIT",
        ].includes(e.code)
      )
        setRetry(request);
      else setRetry(null);
    } finally {
      try {
        const latest = await load();
        if (latest.messages.some((m: any) => m.id === request.requestId)) {
          if (readIdea()?.projectId === id) clearIdea();
        } else {
          setDraft(current => current || content);
        }
      } catch (e: any) {
        setError(e.message);
      }
      setBusy(false);
      sending.current = false;
    }
  }
  const files = (data?.messages || [])
    .filter((m: any) => m.role === "assistant")
    .flatMap((m: any) => extractFiles(m.content).map(file=>({...file,title:fileTitle(file,m.content)})))
    .reverse();
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="p-6">
          <a className="brand" href="/dashboard">
            ✦ <span>Spark</span>
          </a>
        </SidebarHeader>
        <SidebarContent>
          <div className="side-projects">
            <a className="button" href="/dashboard">
              <Plus size={16} /> Projects
            </a>
            <p
              className="eyebrow"
              style={{ justifyContent: "start", margin: "25px 10px 10px" }}
            >
              YOUR PROJECTS
            </p>
            {projects.map((p) => (
              <div key={p.id} className={"sidebar-project-row " + (p.id === id ? "selected" : "")}>
              <a
                href={"/projects/" + p.id}
              >
                {p.name}
              </a>
              <ProjectActions project={p} current={p.id === id} onChanged={async()=>{setProjects((await api("projects")).projects);await load();}}/>
              </div>
            ))}
          </div>
        </SidebarContent>
        <SidebarFooter className="p-5">
          <p className="muted">Live Roblox Studio connection</p>
          <span className="pill" style={{ width: "fit-content" }}>
            Coming soon
          </span>
        </SidebarFooter>
      </Sidebar>
      <main className="workspace-main">
        <header className="workspace-header">
          <SidebarTrigger />
          <h1>{data?.project.name || "Your project"}</h1>
          <button className="workspace-mode" data-active={assetsOpen} aria-label={assetsOpen ? "Back to chat" : "Open Asset Studio"} onClick={() => assetsOpen ? setAssetsOpen(false) : openAssetStudio()}>
            {assetsOpen ? <MessageSquare size={15} /> : <Layers3 size={15} />} {assetsOpen ? "Chat" : "Assets"}
          </button>
          <button
            className="flex items-center gap-2 text-sm"
            onClick={() => setScriptsOpen(true)}
          >
            <Code2 size={17} /> Files ({files.length})
          </button>
          <a className="muted" href="/dashboard">
            Dashboard
          </a>
        </header>
        {assetsOpen ? <AssetStudio key={id} projectId={id} initialPrompt={assetPrompt} /> : <><section
          className="messages"
          aria-label="Conversation"
          aria-live="polite"
        >
          {!data && !error ? (
            <Skeleton className="h-48 rounded-xl" />
          ) : !data ? (
            <div className="error" role="alert">
              {error}
              <br />
              <a href="/dashboard">Back to projects</a>
            </div>
          ) : !data.messages.length ? (
            <div className="welcome">
              <span className="spark-avatar">✦</span>
              <h2>What will you create?</h2>
              <p>
                A new world, a clever mechanic, or your very first script.
                <br />
                Let’s start with your idea.
              </p>
              <div className="suggestions">
                {prompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => {
                      setDraft(p);
                      document.getElementById("message")?.focus();
                    }}
                  >
                    {p} ↗
                  </button>
                ))}
              </div>
            </div>
          ) : (
            data.messages.map((m: any) => (
              <article className={"message " + m.role} key={m.id}>
                {m.role === "assistant" ? (
                  <>
                    <b>✦ Spark</b>
                    {readModelOptions(m.content) ? <ModelChoices options={readModelOptions(m.content)!} projectId={id} messageId={m.id}/> : <Markdown text={m.content} />}
                  </>
                ) : (
                  <>{m.content}{!busy && data.requests?.some((r:any)=>r.id===m.id) && <div className="notice" style={{marginTop:12}}><span>Spark hasn’t completed this reply.</span>{" "}<button onClick={()=>editFailed({content:m.content,requestId:m.id})}>Edit and send again</button></div>}</>
                )}
              </article>
            ))
          )}
          {busy && (
            <p className="muted" role="status">
              {takingLonger ? "✦ Still working — larger scripts can take up to a minute. Please keep this page open." : "✦ Spark is working on your idea…"}
            </p>
          )}
          <div ref={end} />
        </section>
        {data && (
          <div className="composer-wrap">
            {!data.aiConfigured && (
              <div className="notice">
                <strong>AI replies aren’t enabled yet.</strong> You can save your projects and messages while the owner finishes setup.
              </div>
            )}
            {error && (
              <div className="error" role="alert">
                {error}{" "}

              </div>
            )}
            {assetBuild && <div className="usage-estimate" role="status">Spark will suggest a few free Roblox models here · 0 Spark Credits</div>}
            {quote && !assetBuild && (
              <div className="usage-estimate" role="status">
                About {quote.estimatedCredits.toLocaleString()} Spark Credits · Maximum {quote.maxCredits.toLocaleString()}. Only actual usage is charged; unused reserved credits return automatically.
              </div>
            )}
            {draft.trim() && !quote && !assetBuild && <p className="muted" role="status">{quoteError || "Estimating credit usage…"}</p>}
            <form
              className="composer"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <label className="sr-only" htmlFor="message">
                Message Spark
              </label>
              <textarea
                id="message"
                value={draft}
                maxLength={8000}
                onChange={(e) => {setDraft(e.target.value);if(retry && e.target.value.trim()!==retry.content)setRetry(null);}}
                placeholder="What would you like to build?"
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault();
                    send();
                  }
                }}
              />
              <div>
                <small>
                  {draft.length}/8,000 · Shift + Enter for a new line
                </small>
                <button
                  className="button"
                  aria-label="Send message"
                  disabled={busy || !draft.trim() || (!assetBuild && (!quote || quote.content!==draft.trim()))}
                >
                  <ArrowUp size={18} />
                </button>
              </div>
            </form>
            <p className="composer-note">
              Spark suggests code. Review and test it in Roblox Studio before
              publishing.
            </p>
          </div>
        )}</>}
      </main>
      <Sheet open={scriptsOpen} onOpenChange={setScriptsOpen}>
        <SheetContent className="p-6 overflow-auto sm:max-w-xl">
          <SheetTitle>Generated files</SheetTitle>
          <SheetDescription>
            Suggestions from this conversation. Nothing has been installed or
            tested in Roblox Studio.
          </SheetDescription>
          {files.length ? (
            files.map((file: SparkFile, i: number) => (
              <FileCard file={file} key={i} />
            ))
          ) : (
            <p className="muted">
              Ask Spark for a script or a part-based model. Download the generated files here and import them into Roblox Studio manually.
            </p>
          )}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}
