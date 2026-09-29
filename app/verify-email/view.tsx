"use client";
import { useEffect, useState } from "react";
import { api } from "../auth-form";

export default function VerifyEmail() {
  const [email, setEmail] = useState("");
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const linkToken = new URLSearchParams(window.location.hash.slice(1)).get("token") || new URLSearchParams(window.location.search).get("token") || "";
    setToken(linkToken);
    setEmail(window.sessionStorage.getItem("sparkPendingVerificationEmail") || "");
    setMessage(linkToken ? "Click below to verify your email." : window.sessionStorage.getItem("sparkVerificationSent") === "false" ? "We couldn't send the first link. Try resending it below." : "Check your inbox for a verification link.");
    setReady(true);
  }, []);
  async function verify() {
    setBusy(true);
    try {
      await api("auth/verify-email", "POST", { token });
      window.sessionStorage.removeItem("sparkPendingVerificationEmail");
      window.sessionStorage.removeItem("sparkVerificationSent");
      window.history.replaceState(null, "", window.location.pathname);
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
  return <main className="auth-card"><a className="brand" href="/">✦ <span>Spark</span></a><h1>Verify your email.</h1><p>Verified email keeps your account secure and unlocks your workspace.</p>{!ready ? <p role="status">Loading…</p> : token ? <><button className="button" disabled={busy} onClick={verify}>{busy ? "Checking…" : "Verify email"}</button><small><a href="/verify-email">Need a new verification link?</a></small></> : <form onSubmit={resend}><label htmlFor="verify-email">Email address</label><input id="verify-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required /><button className="button" disabled={busy}>{busy ? "Sending…" : "Resend verification link"}</button></form>}<p role="status">{message}</p><small><a href="/login">Back to login</a></small></main>;
}
