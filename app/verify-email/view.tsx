"use client";
import { useState } from "react";
import { api } from "../auth-form";

export default function VerifyEmail() {
  const [email, setEmail] = useState("");
  const [token] = useState(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("token") || "");
  const [message, setMessage] = useState(() => token ? "Click below to verify your email." : "Check your inbox for a verification link.");
  const [busy, setBusy] = useState(false);
  async function verify() {
    setBusy(true);
    try {
      await api("auth/verify-email", "POST", { token });
      setMessage("Email verified. Taking you to your workspace…");
      setTimeout(() => location.assign("/upgrade"), 700);
    } catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  async function resend(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try { await api("auth/resend-verification", "POST", { email }); setMessage("If that email needs verification, a new link is on its way."); }
    catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
  }
  return <main className="auth-card"><a className="brand" href="/">✦ <span>Spark</span></a><h1>Verify your email.</h1><p>Verified email keeps your account secure and unlocks your workspace.</p>{token ? <button className="button" disabled={busy} onClick={verify}>{busy ? "Checking…" : "Verify email"}</button> : <form onSubmit={resend}><label htmlFor="verify-email">Email address</label><input id="verify-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required /><button className="button" disabled={busy}>{busy ? "Sending…" : "Resend verification link"}</button></form>}<p role="status">{message}</p><small><a href="/login">Back to login</a></small></main>;
}
