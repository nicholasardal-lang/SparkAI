"use client";
import { LogoMark } from "@/components/brand";
import { useEffect, useState } from "react";
import { Plus, Folder, ArrowUpRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogFooter,
} from "@/components/ui/alert-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../auth-form";
import AccountMenu from "../account-menu";
import { readIdea, saveIdea, clearIdea, type StartingIdea } from "@/lib/spark/draft";
export default function Dashboard({ billing }: { billing: any }) {
  const [idea, setIdea] = useState<StartingIdea | null>(null);
  const [projects, setProjects] = useState<any[]>([]),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [editing, setEditing] = useState<any>(null),
    [deleting, setDeleting] = useState<any>(null),
    [busy, setBusy] = useState(false);
  async function load() {
    try {
      setProjects((await api("projects")).projects);
      setError("");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
    setIdea(readIdea());
  }, []);
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: "start_project_creation",
          description:
            "Open the new project form with a proposed project name. This does not save the project.",
          inputSchema: {
            type: "object",
            properties: { name: { type: "string", maxLength: 80 } },
            required: ["name"],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false },
          execute: (input: any) => {
            if (
              typeof input?.name !== "string" ||
              !input.name.trim() ||
              input.name.length > 80
            )
              throw new Error("Provide a project name of 1–80 characters.");
            setEditing({ name: input.name, description: "" });
            return { status: "form_opened" };
          },
        },
        { signal: controller.signal },
      ),
    ).catch(() => {});
    return () => controller.abort();
  }, []);
  return (
    <>
      <nav className="nav">
        <a className="brand" href="/">
          <LogoMark /> <span>Spark</span>
        </a>
        <AccountMenu/>
      </nav>
      <main className="dashboard">
        <div className="billing-summary"><strong>{billing.credits.toLocaleString()} Spark Credits</strong><span>{billing.active ? `${billing.plan} plan` : "Credit balance"}</span><a href="/account?tab=billing">Manage billing ↗</a></div>
        {idea && !idea.projectId && <section className="starting-idea"><h2>Your idea came with you.</h2><p>{idea.content}</p><button className="button" onClick={() => { setError(""); setEditing({ name: "My next game", description: "", useIdea: true }); }}>Create a project with this idea</button><button onClick={() => { clearIdea(); setIdea(null); }}>Dismiss</button></section>}
        <div className="dashboard-heading">
          <div>
            <div className="eyebrow" style={{ justifyContent: "start" }}>
              YOUR CREATIVE SPACE
            </div>
            <h1>Let’s build something.</h1>
            <p className="muted">Every great game starts with an idea.</p>
          </div>
          <button
            className="button"
            onClick={() => setEditing({ name: "", description: "" })}
          >
            <Plus size={17} /> New project
          </button>
        </div>
        <section className="dashboard-starters"><div><h2>Start with a spark</h2><p className="muted">Choose a starting point. Make it your own.</p></div><div className="starter-grid">{[{name:"Obby adventure",description:"Plan an obstacle course with checkpoints, stages, and a finish reward."},{name:"Survival world",description:"Design a survival loop with resources, crafting, and escalating challenges."},{name:"Fix a script",description:"Bring a Luau script and its error message to work through the problem."}].map(s=><button key={s.name} onClick={()=>setEditing(s)}><strong>{s.name}</strong><span>{s.description}</span><span>Start project ↗</span></button>)}</div></section>
        <h2>Your projects <small className="muted">{projects.length}</small></h2>
        {error && (
          <div className="error" role="alert">
            {error} <button onClick={load}>Try again</button>
          </div>
        )}
        {loading ? (
          <Skeleton className="h-48 rounded-xl" />
        ) : projects.length ? (
          <div className="project-grid">
            {projects.map((p) => (
              <article className="project-card" key={p.id}>
                <Folder color="#A78BFA" size={25} />
                <a href={"/projects/" + p.id}>
                  <h2>{p.name}</h2>
                </a>
                <p>{p.description || "A new world waiting to happen."}</p>
                <small>
                  Updated{" "}
                  {new Date(p.updated).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </small>
                <div className="card-actions">
                  <a style={{ color: "#A78BFA" }} href={"/projects/" + p.id}>
                    Open project ↗
                  </a>
                  <button onClick={() => setEditing(p)}>Rename</button>
                  <button onClick={() => setDeleting(p)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <span className="spark-avatar"><LogoMark /></span>
            <h2>A blank canvas. A big possibility.</h2>
            <p>
              Create your first project to start planning, scripting, and
              solving.
            </p>
            <button
              className="button"
              onClick={() => setEditing({ name: "", description: "" })}
            >
              Create your first project <ArrowUpRight size={17} />
            </button>
          </div>
        )}
      </main>
      <Dialog
        open={!!editing}
        onOpenChange={(open) => {
          if (!open && !busy) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogTitle>
            {editing?.id ? "Edit project" : "Create a project"}
          </DialogTitle>
          <DialogDescription>
            Give your next game a name. You can change it later.
          </DialogDescription>
          <form
            key={editing?.id || "new"}
            onSubmit={async (e) => {
              e.preventDefault();
              if (busy) return;
              setBusy(true);
              const data = new FormData(e.currentTarget);
              try {
                const result = await api(
                  "projects" + (editing.id ? "/" + editing.id : ""),
                  editing.id ? "PATCH" : "POST",
                  {
                    name: data.get("name"),
                    description: data.get("description"),
                  },
                );
                if (!editing.id) {
                  if (editing.useIdea && idea) saveIdea(idea.content, result.id);
                  location.assign("/projects/" + result.id);
                }
                else {
                  setEditing(null);
                  await load();
                }
              } catch (e: any) {
                setError(e.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label htmlFor="project-name">Project name</label>
            <input
              id="project-name"
              name="name"
              defaultValue={editing?.name}
              maxLength={80}
              required
            />
            <label htmlFor="description">
              Description <span className="muted">(optional)</span>
            </label>
            <textarea
              id="description"
              name="description"
              defaultValue={editing?.description}
              maxLength={500}
            />
            {error && (
              <div className="error" role="alert">
                {error}
              </div>
            )}
            <button
              className="button"
              style={{ marginTop: 20 }}
              disabled={busy}
            >
              {busy
                ? "Saving…"
                : editing?.id
                  ? "Save changes"
                  : "Create project"}
            </button>
          </form>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={!!deleting}
        onOpenChange={(open) => {
          if (!open && !busy) setDeleting(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Delete {deleting?.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            This permanently deletes the project and its conversation. This
            cannot be undone.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Keep project</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  await api("projects/" + deleting.id, "DELETE", {});
                  setDeleting(null);
                  await load();
                } catch (e: any) {
                  setError(e.message);
                  setDeleting(null);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
