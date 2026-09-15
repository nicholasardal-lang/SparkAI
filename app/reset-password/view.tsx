"use client";
import { useState } from "react";
import { api } from "../auth-form";

export default function ResetPassword() {
  const [token] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("token") || "");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api("auth/reset-password", "POST", { token, password }); setMessage("Password updated. You can log in now."); setTimeout(() => location.assign("/login"), 900); }
    catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  return <main className="auth-card"><a className="brand" href="/">✦ <span>Spark</span></a><h1>Choose a new password.</h1><p>Use at least 12 characters. Your other sessions will be signed out.</p><form onSubmit={submit}><label htmlFor="new-password">New password</label><input id="new-password" type="password" minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} required /><button className="button" disabled={busy || !token}>{busy ? "Saving…" : "Save new password"}</button></form>{!token && <p role="alert" className="error">This reset link is missing. Request a new one.</p>}{message && <p role="status">{message}</p>}</main>;
}
