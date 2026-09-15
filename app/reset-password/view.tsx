"use client";
import { useEffect, useState } from "react";
import { api } from "../auth-form";

export default function ResetPassword() {
  const [token, setToken] = useState("");
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    // Accept previously emailed query links as well as new fragment links.
    setToken(new URLSearchParams(window.location.hash.slice(1)).get("token") || new URLSearchParams(window.location.search).get("token") || "");
    setReady(true);
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError("");
    if (password !== confirm) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      await api("auth/reset-password", "POST", { token, password });
      setDone(true); setPassword(""); setConfirm("");
      window.history.replaceState(null, "", window.location.pathname);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Please try again."); }
    finally { setBusy(false); }
  }
  return <main className="auth-card">
    <a className="brand" href="/">✦ <span>Spark</span></a>
    <h1>Choose a new password.</h1>
    <p>Use at least 12 characters. Your other sessions will be signed out.</p>
    {!ready ? <p role="status">Loading…</p> : done ? <p role="status">Password updated. You can log in now.</p> : !token ? <p role="alert" className="error">This reset link is missing. <a href="/forgot-password">Request a new one.</a></p> : <form onSubmit={submit}>
      <label htmlFor="new-password">New password</label>
      <input id="new-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} required />
      <label htmlFor="confirm-password">Confirm new password</label>
      <input id="confirm-password" type={showPassword ? "text" : "password"} autoComplete="new-password" minLength={12} maxLength={128} value={confirm} onChange={e => setConfirm(e.target.value)} required />
      <button type="button" className="password-toggle" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide passwords" : "Show passwords"}</button>
      <button className="button" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
    </form>}
    {error && <p role="alert" className="error">{error} <a href="/forgot-password">Request a new link</a></p>}
    <small><a href="/login">Back to login</a></small>
  </main>;
}
