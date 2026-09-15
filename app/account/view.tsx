"use client";
import { useEffect, useState } from "react";
import AccountMenu from "../account-menu";
import { api } from "../auth-form";

type Transaction = { id: string; amount: number; source: string; created_at: number; stripe_reference?: string };

const sourceLabels: Record<string, string> = {
  subscription_grant: "Monthly plan credits",
  credit_pack: "Credit pack purchase",
  ai_usage: "Spark request",
};

export default function AccountView({ user }: { user: any }) {
  const [tab, setTab] = useState("profile");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [color, setColor] = useState(user.avatar_color || "violet");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t && ["profile", "settings", "billing", "security"].includes(t)) setTab(t);
  }, []);

  useEffect(() => {
    if (tab !== "billing") return;
    setTransactionsLoading(true);
    api("billing/transactions")
      .then((result) => setTransactions(result.transactions || []))
      .catch(() => setMessage("Credit activity could not load. Refresh to retry."))
      .finally(() => setTransactionsLoading(false));
  }, [tab]);

  async function save(e: React.FormEvent<HTMLFormElement>, path: string, extra: any = {}) {
    e.preventDefault(); setBusy(true); setMessage("");
    const data = Object.fromEntries(new FormData(e.currentTarget));
    try {
      await api(path, path === "profile" ? "PATCH" : "POST", { ...data, ...extra });
      if (path === "security" && extra.action === "password") location.assign("/login");
      else setMessage("Saved successfully.");
    } catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  async function resendVerification() {
    setBusy(true); setMessage("");
    try { await api("auth/resend-verification", "POST", { email: user.email }); setMessage("If your account needs verification, a new link is on its way."); }
    catch (e: any) { setMessage(e.message); }
    finally { setBusy(false); }
  }

  return <>
    <nav className="nav"><a className="brand" href="/dashboard">✦ <span>Spark</span></a><AccountMenu /></nav>
    <main className="dashboard account-page">
      <a href="/dashboard">← Back to workspace</a><h1>Your account</h1>
      <div className="account-tabs">{["profile", "settings", "billing", "security"].map(t => <button key={t} aria-pressed={tab === t} onClick={() => { setTab(t); setMessage(""); history.replaceState(null, "", "?tab=" + t); }}>{t}</button>)}</div>
      <section className="account-panel">
        {(tab === "profile" || tab === "settings") && <form onSubmit={e => save(e, "profile", { avatarColor: color })}>
          <h2>{tab === "profile" ? "Make it yours" : "Appearance"}</h2>
          <span className={"profile-avatar avatar-large " + color}>{user.username?.slice(0, 2).toUpperCase() || "✦"}</span>
          <label htmlFor="profile-name">Username</label><input id="profile-name" name="username" defaultValue={user.username || ""} required minLength={3} maxLength={24} pattern="[a-zA-Z0-9_]+" />
          <p className="muted">Your email stays private: {user.email}</p>
          <label>Avatar color</label><div className="avatar-colors">{["violet", "blue", "rose", "green", "amber"].map(c => <button type="button" key={c} className={"profile-avatar " + c} aria-label={c} aria-pressed={color === c} onClick={() => setColor(c)}>{color === c ? "✓" : "✦"}</button>)}</div>
          <button className="button" disabled={busy}>Save profile</button>
        </form>}
        {tab === "billing" && <>
          <h2>Plan and credits</h2>
          <h3>{user.billing?.credits?.toLocaleString() || 0} Spark Credits available</h3>
          <p>Subscription: {user.billing?.plan || "No plan"} · {user.billing?.status || "none"}</p>
          {user.billing?.paidUntil && <p>{user.billing.cancelAtPeriodEnd ? "Access ends" : "Paid through"}: {new Date(user.billing.paidUntil).toLocaleDateString()}</p>}
          {user.email_verification_required === 1 && !user.email_verified_at && <div className="notice"><strong>Verify your email to manage billing.</strong><p>We sent a verification link to {user.email}.</p><button className="button" disabled={busy} onClick={resendVerification}>Resend verification email</button></div>}
          <p>Monthly plan credits expire at the end of their credit month. Purchased credits do not expire. Larger requests use more credits based on AI input and output tokens.</p>
          <div className="card-actions"><button className="button" disabled={busy || (user.email_verification_required === 1 && !user.email_verified_at)} onClick={async () => { setBusy(true); try { const r = await api("billing/portal", "POST", {}); location.assign(r.url); } catch (e: any) { setMessage(e.message); setBusy(false); } }}>Manage subscription and payments</button><a className="button" href="/pricing">Plans and credit packs</a></div>
          <div className="credit-activity"><h3>Credit activity</h3>{transactionsLoading ? <p className="muted">Loading activity…</p> : transactions.length ? <div className="transaction-list">{transactions.map(row => <div className="transaction-row" key={row.id}><span><strong>{sourceLabels[row.source] || row.source}</strong><small>{new Date(row.created_at).toLocaleString()}</small></span><b className={row.amount < 0 ? "debit" : "credit"}>{row.amount > 0 ? "+" : ""}{row.amount.toLocaleString()}</b></div>)}</div> : <p className="muted">No credit activity yet.</p>}</div>
        </>}
        {tab === "security" && <><h2>Password and sessions</h2><form onSubmit={e => save(e, "security", { action: "password" })}><label htmlFor="current">Current password</label><input id="current" name="currentPassword" type="password" autoComplete="current-password" required /><label htmlFor="next">New password</label><input id="next" name="newPassword" type="password" autoComplete="new-password" minLength={12} maxLength={128} required /><p>Changing your password signs out all devices. Sign in again with your new password.</p><button className="button" disabled={busy}>Change password</button></form><hr /><form onSubmit={e => save(e, "security", { action: "sessions" })}><h3>Sign out other devices</h3><label htmlFor="sessions-password">Confirm current password</label><input id="sessions-password" name="currentPassword" type="password" autoComplete="current-password" required /><button className="button" disabled={busy}>Sign out other devices</button></form></>}
        {message && <p role="status">{message}</p>}
      </section>
    </main>
  </>;
}
