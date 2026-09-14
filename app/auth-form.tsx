"use client";
import { useState } from "react";
import GameInspiration from "./game-inspiration";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import LegalContent from "./legal-content";
import { LEGAL_VERSION, legalDocuments } from "@/lib/spark/legal";
export async function api(path: string, method = "GET", data?: unknown) {
  const response = await fetch("/api/" + path, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result: any = await response.json().catch(() => ({ error: "Something went wrong. Please try again in a moment." }));
  if (!response.ok) {
    const error: any = new Error(result.error || "Request failed.");
    error.code = result.code;
    throw error;
  }
  return result;
}
export default function AuthForm({ signup = false }: { signup?: boolean }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [legal, setLegal] = useState<"terms" | "privacy" | null>(null);
  return (
    <main className={signup ? "auth-layout" : "login-layout"}>
    <section className="auth-card">
      <a className="brand" href="/">
        <span className="logo-mark" aria-hidden="true">✦</span><span>Spark</span>
      </a>
      <h1>{signup ? "Your next idea starts here." : "Welcome back."}</h1>
      <p>
        {signup
          ? "Create an account and give your game a home."
          : "Pick up where your imagination left off."}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (busy) return;
          if (signup && !accepted) { setError("Please agree to the Terms of Service and Privacy Policy."); return; }
          setBusy(true);
          setError("");
          const data = new FormData(e.currentTarget);
          try {
            await api("auth/" + (signup ? "signup" : "login"), "POST", {
              email: data.get("email"),
              password: data.get("password"),
              ...(signup ? { acceptedLegal: accepted, legalVersion: LEGAL_VERSION } : {}),
            });
            const next = new URLSearchParams(window.location.search).get("next");
            window.location.assign(signup || next === "/upgrade" ? "/upgrade" : "/dashboard");
          } catch (e: any) {
            setError(e.message);
            setBusy(false);
          }
        }}
      >
        <label htmlFor="email">Email address</label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
        />
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type={showPassword ? "text" : "password"}
          autoComplete={signup ? "new-password" : "current-password"}
          minLength={12}
          maxLength={128}
          required
        />
        <button className="password-toggle" type="button" aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide password" : "Show password"}</button>
        {signup && (
          <small style={{ textAlign: "left", marginTop: 6 }}>
            Use at least 12 characters.
          </small>
        )}
        {signup && <div className="agreement-row"><Checkbox id="legal-agreement" checked={accepted} onCheckedChange={value => setAccepted(value === true)} required aria-labelledby="agreement-label"/><label id="agreement-label" htmlFor="legal-agreement">I agree to the <a href="/terms" onClick={event => { event.preventDefault(); setLegal("terms"); }}>Terms of Service</a> and <a href="/privacy" onClick={event => { event.preventDefault(); setLegal("privacy"); }}>Privacy Policy</a>.</label></div>}
        {error && (
          <div role="alert" className="error">
            {error}
          </div>
        )}
        <button className="button" disabled={busy}>
          {busy ? "Please wait…" : signup ? "Create account" : "Log in"}
        </button>
      </form>
      <small>
        {signup ? "Already have an account?" : "New to Spark?"}{" "}
        <a href={signup ? "/login" : "/signup"} onClick={(e) => {
          if (new URLSearchParams(window.location.search).get("next") === "/upgrade") {
            e.preventDefault(); window.location.assign((signup ? "/login" : "/signup") + "?next=%2Fupgrade");
          }
        }}>
          {signup ? "Log in" : "Create an account"}
        </a>
      </small>
    </section>
    {signup && <GameInspiration />}
    <Dialog open={!!legal} onOpenChange={open => { if (!open) setLegal(null); }}><DialogContent className="legal-dialog sm:max-w-2xl"><DialogTitle>{legal ? legalDocuments[legal].title : "Legal information"}</DialogTitle><DialogDescription>Read the draft below. Closing this window does not change your agreement choice.</DialogDescription>{legal && <LegalContent kind={legal}/>}<button className="button" onClick={() => setLegal(null)}>Close</button></DialogContent></Dialog>
    </main>
  );
}
