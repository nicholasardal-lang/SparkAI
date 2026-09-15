"use client";
import { useRef, useState } from "react";

export default function AvatarUpload() {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState("");
  async function upload(file?: File) {
    if (!file) return;
    setBusy(true); setMessage("");
    try {
      if (!["image/png","image/jpeg","image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("Choose a PNG, JPEG, or WebP under 5 MB.");
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement("canvas"); canvas.width = canvas.height = 256;
      const context = canvas.getContext("2d"); if (!context) { bitmap.close(); throw new Error("Your browser could not prepare this picture."); }
      const side = Math.min(bitmap.width, bitmap.height);
      context.drawImage(bitmap, (bitmap.width-side)/2, (bitmap.height-side)/2, side, side, 0, 0, 256, 256);
      bitmap.close();
      const blob = await new Promise<Blob>((resolve,reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("Could not prepare your picture.")), "image/png"));
      const response = await fetch("/api/profile/avatar", { method:"PUT", headers:{"Content-Type":"image/png"}, body:blob });
      if (!response.ok) throw new Error(((await response.json()) as {error?:string}).error || "Could not upload your picture.");
      window.dispatchEvent(new Event("spark-profile-updated")); setMessage("Picture saved.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not upload your picture."); }
    finally { setBusy(false); if(input.current) input.current.value = ""; }
  }
  async function remove() {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/profile/avatar", {method:"DELETE"});
      if (!response.ok) throw new Error(((await response.json()) as {error?:string}).error || "Could not remove your picture.");
      window.dispatchEvent(new Event("spark-profile-updated")); setMessage("Default avatar restored.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not remove your picture."); }
    finally { setBusy(false); }
  }
  return <div className="avatar-upload"><input ref={input} type="file" accept="image/png,image/jpeg,image/webp" hidden aria-label="Choose profile picture" onChange={e => upload(e.target.files?.[0])}/><div className="card-actions"><button type="button" className="button" disabled={busy} onClick={() => input.current?.click()}>{busy ? "Saving…" : "Upload picture"}</button><button type="button" disabled={busy} onClick={remove}>Use default avatar</button></div><small>PNG, JPEG, or WebP · up to 5 MB. Cropped to a square.</small>{message && <small role="status">{message}</small>}</div>;
}
