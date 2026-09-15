"use client";
import { useState } from "react";
import { MoreHorizontal, Pencil, Download, Trash2 } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { api } from "./auth-form";

export default function ProjectActions({ project, current, onChanged }: {project:{id:string;name:string;description:string};current:boolean;onChanged:()=>Promise<void>}) {
  const [mode,setMode]=useState<"edit"|"delete"|null>(null), [busy,setBusy]=useState(false), [error,setError]=useState("");
  async function download() {
    setBusy(true); setError("");
    try {
      const data=await api("projects/"+project.id);
      const text=`# ${project.name}\n\n${project.description || ""}\n\n`+data.messages.map((m:{role:string;content:string})=>`## ${m.role === "assistant" ? "Spark" : "You"}\n\n${m.content}`).join("\n\n");
      const url=URL.createObjectURL(new Blob([text],{type:"text/markdown;charset=utf-8"}));
      const link=document.createElement("a"); link.href=url; link.download=(project.name.replace(/[^a-z0-9_-]/gi,"-")||"spark-project")+".md"; link.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e) { setError(e instanceof Error?e.message:"Download failed."); }
    finally { setBusy(false); }
  }
  return <><DropdownMenu><DropdownMenuTrigger className="project-menu-trigger" aria-label={`Options for ${project.name}`} disabled={busy}><MoreHorizontal size={18}/></DropdownMenuTrigger><DropdownMenuContent align="start"><DropdownMenuItem onSelect={()=>{setError("");setMode("edit");}}><Pencil size={16}/>Project settings</DropdownMenuItem><DropdownMenuItem onSelect={()=>void download()}><Download size={16}/>Download conversation</DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem className="text-red-300" onSelect={()=>{setError("");setMode("delete");}}><Trash2 size={16}/>Delete project</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    <Dialog open={!!mode} onOpenChange={open=>{if(!open&&!busy)setMode(null);}}><DialogContent><DialogTitle>{mode==="delete"?"Delete project?":"Project settings"}</DialogTitle><DialogDescription>{mode==="delete"?`This permanently deletes ${project.name} and its saved conversation.`:"Update your project name and description."}</DialogDescription>
      <form className="project-settings-form" key={mode} onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);setError("");const fields=new FormData(e.currentTarget);try{await api("projects/"+project.id,mode==="delete"?"DELETE":"PATCH",mode==="delete"?{}:{name:fields.get("name"),description:fields.get("description")});if(mode==="delete"&&current){location.assign("/dashboard");return;}await onChanged();setMode(null);}catch(e){setError(e instanceof Error?e.message:"Could not save changes.");}finally{setBusy(false);}}}>
      {mode==="edit"&&<><label htmlFor={`name-${project.id}`}>Project name</label><input id={`name-${project.id}`} name="name" defaultValue={project.name} required maxLength={80}/><label htmlFor={`description-${project.id}`}>Description</label><textarea id={`description-${project.id}`} name="description" defaultValue={project.description} maxLength={500}/></>}
      {error&&<p role="alert" className="error">{error}</p>}<div className="card-actions"><button type="button" disabled={busy} onClick={()=>setMode(null)}>Cancel</button><button className="button" disabled={busy}>{busy?"Please wait…":mode==="delete"?"Delete project":"Save changes"}</button></div></form>
    </DialogContent></Dialog>{error&&!mode&&<small className="error project-action-error" role="alert">{error}</small>}</>;
}
