"use client";
import { useEffect, useRef, useState } from "react";
import { Code2, ArrowUp, Plus } from "lucide-react";
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
import { readIdea, clearIdea } from "@/lib/spark/draft";
const prompts = [
  "Help me plan an obby.",
  "Create a checkpoint system.",
  "Help me fix a Luau script.",
  "Design a round-based survival game.",
];
function Code({
  code,
  language = "luau",
}: {
  code: string;
  language?: string;
}) {
  const [status, setStatus] = useState("Copy");
  return (
    <section className="code-block">
      <header>
        <span>{language}</span>
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
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          pre: ({ children }) => <>{children}</>,
          code: ({ children, className, node, ...props }) => {
            const content = String(children);
            return className?.startsWith("language-") ||
              content.includes("\n") ? (
              <Code
                language={className?.replace("language-", "") || "code"}
                code={content.replace(/\n$/, "")}
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
        {text}
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
    [retry, setRetry] = useState<any>(null);
  const sending = useRef(false),
    end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled=false;
    setQuote(null);
    setQuoteError("");
    if (!draft.trim()) return;
    const content=draft.trim();
    const timer=setTimeout(() => {
      api("projects/"+id+"/estimate","POST",{content}).then(result => {
        if(!cancelled) setQuote({...result,content});
      }).catch(e => { if(!cancelled) setQuoteError(e.message); });
    },400);
    return () => {cancelled=true;clearTimeout(timer);};
  },[draft,id,data?.messages?.length]);
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
  async function send(retrying?: any) {
    if (sending.current) return;
    const content = retrying?.content || draft.trim();
    if (!content) return;
    if (!quote || quote.content!==content) {
      try {
        const result=await api("projects/"+id+"/estimate","POST",{content,requestId:retrying?.requestId});
        setQuote({...result,content});
        setRetry(retrying || {content,requestId:crypto.randomUUID()});
        setError("Review the model and credit estimate below, then press Retry to send.");
      } catch(e:any) {setError(e.message);}
      return;
    }
    sending.current = true;
    setBusy(true);
    setError("");
    const request = retrying || { content, requestId: crypto.randomUUID() };
    setRetry(request);
    try {
      await api("projects/" + id + "/messages", "POST", {...request,model:quote.model,maxCredits:quote.maxCredits});
      setDraft((current) => current.trim() === content ? "" : current);
      setRetry(null);
    } catch (e: any) {
      setError(e.message);
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
          setDraft((current) => (current.trim() === content ? "" : current));
          if (readIdea()?.projectId === id) clearIdea();
        }
      } catch (e: any) {
        setError(e.message);
      }
      setBusy(false);
      sending.current = false;
    }
  }
  const scripts = (data?.messages || [])
    .filter((m: any) => m.role === "assistant")
    .flatMap((m: any) =>
      [...m.content.matchAll(/```(?:luau|lua)?\s*\n([\s\S]*?)```/g)].map(
        (match: any) => match[1],
      ),
    );
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
          <p className="muted">Roblox Studio integration</p>
          <span className="pill" style={{ width: "fit-content" }}>
            Coming soon
          </span>
        </SidebarFooter>
      </Sidebar>
      <main className="workspace-main">
        <header className="workspace-header">
          <SidebarTrigger />
          <h1>{data?.project.name || "Your project"}</h1>
          <button
            className="flex items-center gap-2 text-sm"
            onClick={() => setScriptsOpen(true)}
          >
            <Code2 size={17} /> Scripts ({scripts.length})
          </button>
          <a className="muted" href="/dashboard">
            Dashboard
          </a>
        </header>
        <section
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
                    <Markdown text={m.content} />
                  </>
                ) : (
                  m.content
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
                {retry && (
                  <button
                    disabled={busy}
                    onClick={() => send(retry)}
                    style={{ textDecoration: "underline" }}
                  >
                    Retry message
                  </button>
                )}
              </div>
            )}
            {!busy && data.requests?.length > 0 && (
              <details className="muted">
                <summary>
                  Messages awaiting a response ({data.requests.length})
                </summary>
                {data.requests.map((r: any) => (
                  <div key={r.id} style={{ margin: "7px 0" }}>
                    {r.content.slice(0, 70)}{" "}
                    <button
                      onClick={() =>
                        send({ content: r.content, requestId: r.id })
                      }
                      style={{ color: "#A78BFA" }}
                    >
                      Retry
                    </button>
                  </div>
                ))}
              </details>
            )}
            {quote && (
              <div className="usage-estimate" role="status">
                Auto · {quote.label} — {quote.reason}. Estimated {quote.estimatedCredits.toLocaleString()} Spark Credits; up to {quote.maxCredits.toLocaleString()} reserved. You pay for actual usage; unused credits are returned.
              </div>
            )}
            {draft.trim() && !quote && <p className="muted" role="status">{quoteError || "Checking model and credit estimate…"}</p>}
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
                onChange={(e) => setDraft(e.target.value)}
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
                  disabled={busy || !draft.trim() || !quote || quote.content!==draft.trim()}
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
        )}
      </main>
      <Sheet open={scriptsOpen} onOpenChange={setScriptsOpen}>
        <SheetContent className="p-6 overflow-auto sm:max-w-xl">
          <SheetTitle>Generated scripts</SheetTitle>
          <SheetDescription>
            Suggestions from this conversation. Nothing has been installed or
            tested in Roblox Studio.
          </SheetDescription>
          {scripts.length ? (
            scripts.map((code: string, i: number) => (
              <Code code={code} key={i} />
            ))
          ) : (
            <p className="muted">
              Scripts will appear here when Spark includes Luau code in a
              response.
            </p>
          )}
        </SheetContent>
      </Sheet>
    </SidebarProvider>
  );
}
