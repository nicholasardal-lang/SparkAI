"use client";
import { LogoMark } from "@/components/brand";
import { useEffect, useState } from "react";
import { Check, Zap } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { plans, creditPacks } from "@/lib/spark/plans";
import { api } from "./auth-form";
export default function PlansView({ signedIn = false }: { signedIn?: boolean }) {
  const [yearly, setYearly] = useState(false);
  const [selection, setSelection] = useState<{ title: string; price: number; details: string; planId?: string; packName?: string } | null>(null);
  const selectedPlan = plans.find(plan => plan.id === selection?.planId);
  const checkoutPrice = selectedPlan ? (yearly ? selectedPlan.yearly : selectedPlan.monthly) : selection?.price;
  const [error, setError] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("checkout") !== "success") return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    setConfirmingPayment(true);
    const checkAccess = async () => {
      try {
        const result = await api("me");
        if (result.user?.workspace_enabled === 1) {
          window.location.replace("/dashboard");
          return;
        }
      } catch {
        // Keep checking briefly while Stripe finishes delivering the webhook.
      }
      attempts += 1;
      if (!cancelled && attempts < 15) timer = setTimeout(checkAccess, 1000);
      else if (!cancelled) {
        setConfirmingPayment(false);
        setError("Your payment succeeded, but Spark is still confirming it. Refresh this page in a moment.");
      }
    };
    void checkAccess();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, []);
  return <main className="plans-page">
    <nav className="plans-nav"><a className="brand" href="/"><LogoMark /><span>Spark</span></a>{signedIn ? <button onClick={async () => { try { await api("auth/logout", "POST", {}); location.assign("/"); } catch { setError("Could not log out. Please try again."); } }}>Log out</button> : <a href="/login">Log in</a>}</nav>
    {confirmingPayment && <p className="notice" role="status">Payment confirmed. Unlocking your Spark workspace…</p>}
    <header className="plans-heading"><span className="pill">YOUR NEXT CHAPTER</span><h1>Give your ideas room to <span>grow.</span></h1><p>{signedIn ? "Your account is ready. Choose a plan or add credits to unlock Spark." : "Choose the right amount of Spark for the way you build."}</p></header>
    <div className="billing-toggle" role="group" aria-label="Billing frequency"><button aria-pressed={!yearly} onClick={() => setYearly(false)}>Monthly</button><button aria-pressed={yearly} onClick={() => setYearly(true)}>Yearly <span>Save 16.7%</span></button></div>
    <div className="plans-grid">{plans.map(plan => <article key={plan.id} className={"pricing-card " + (plan.id === "creator" ? "recommended" : "")}>
      <div className="plan-title"><h2>{plan.name}</h2>{plan.id === "creator" && <span className="pill">Most Popular</span>}</div>
      <p>{plan.description}</p><div className="plan-price">${yearly ? (plan.yearly / 12).toLocaleString("en-US", { maximumFractionDigits: 2 }) : plan.monthly}<span>/ month</span></div>
      <p className="billing-detail">{yearly ? <><s aria-label="Cost of twelve monthly payments">${plan.monthly * 12}</s> <strong>${plan.yearly} billed yearly</strong><br/><span className="annual-saving">Save ${plan.monthly * 12 - plan.yearly} per year</span></> : `$${plan.monthly} billed monthly`}</p>
      <div className="plan-credits"><Zap size={18}/><strong>{plan.credits.toLocaleString("en-US")} Spark Credits</strong><span>every month</span></div>
      <ul>{["Game planning and Luau scripting", "Debugging and code explanations", "Saved projects and conversations", "Optional credit top-ups"].map(feature => <li key={feature}><Check size={16}/>{feature}</li>)}</ul>
      <button className="button" onClick={() => signedIn ? setSelection({ planId: plan.id, title: `Spark ${plan.name}`, price: plan.monthly, details: `${plan.credits.toLocaleString("en-US")} credits issued each month` }) : location.assign("/signup")}>Choose {plan.name}</button>
    </article>)}</div>
    <section id="credits" className="topups"><div><h2>A little extra spark.</h2><p>Prefer to start with credits? Buy a pack without a subscription, or top up your plan.</p></div><div className="topup-grid">{creditPacks.map(pack => <button key={pack.name} className="topup-card" onClick={() => signedIn ? setSelection({ packName: pack.name, title: `${pack.name} credit pack`, price: pack.price, details: `${pack.credits.toLocaleString("en-US")} Spark Credits · one-time purchase` }) : location.assign("/signup")}><span>{pack.name}</span><strong>{pack.credits.toLocaleString("en-US")} <small>credits</small></strong><span>${pack.price} <span aria-hidden="true">↗</span></span></button>)}</div></section>
    <section className="credit-explainer"><h2>Small question. Big build. Credits follow the work.</h2><p>Requests use Spark Credits based on the AI resources they consume. Longer requests, larger conversations, and more involved responses can use more credits. Spark Credits are separate from OpenAI tokens.</p><p>Plan credits refresh monthly, including on yearly plans. Unused plan credits expire at renewal. Purchased credits roll over and do not require an active subscription.</p><p className="notice">Stripe sandbox checkout is active. Sandbox payments are tests and do not move real money. Credit usage rates will be shown before live purchases open.</p></section>
    {error && <p className="error" role="alert">{error}</p>}
    <div className="legal-footer"><a href="/terms">Terms of Service</a><a href="/privacy">Privacy Policy</a><span>Prices in USD.</span></div>
    <Dialog open={!!selection} onOpenChange={open => { if (!open) { setSelection(null); setError(""); } }}><DialogContent className="checkout-preview"><DialogTitle>{selection?.title}</DialogTitle><DialogDescription>{selection?.details}</DialogDescription>
      {selectedPlan && <div className="checkout-billing" role="group" aria-label="Checkout billing frequency">
        <button aria-pressed={!yearly} onClick={() => setYearly(false)}><strong>Monthly</strong><span>${selectedPlan.monthly} billed every month</span></button>
        <button aria-pressed={yearly} onClick={() => setYearly(true)}><strong>Annual <span className="annual-saving">Save ${selectedPlan.monthly * 12 - selectedPlan.yearly}</span></strong><span><s>${selectedPlan.monthly * 12}</s> ${selectedPlan.yearly} billed once a year</span><span>${(selectedPlan.yearly / 12).toLocaleString("en-US", { maximumFractionDigits: 2 })}/month equivalent</span></button>
      </div>}
      <div className="checkout-total"><span>{selectedPlan ? (yearly ? "Annual total" : "Monthly total") : "One-time total"}</span><strong>${checkoutPrice}</strong></div>
      {selectedPlan && yearly && <p className="annual-saving">Save ${selectedPlan.monthly * 12 - selectedPlan.yearly} compared with 12 monthly payments. Credits still arrive monthly.</p>}
      <p>Stripe opens a secure checkout page. Spark unlocks only after Stripe confirms the sandbox payment.</p>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button" disabled={checkoutBusy} onClick={async () => {
        if (!selection) return;
        setCheckoutBusy(true); setError("");
        try {
          const result = await api("billing/checkout", "POST", selectedPlan
            ? { kind: "plan", planId: selectedPlan.id, period: yearly ? "yearly" : "monthly" }
            : { kind: "pack", packName: selection.packName });
          location.assign(result.url);
        } catch (e: any) { setError(e.message); setCheckoutBusy(false); }
      }}>{checkoutBusy ? "Opening Stripe…" : "Continue to secure checkout"}</button>
      <button onClick={() => setSelection(null)}>Back to options</button></DialogContent></Dialog>
  </main>;
}
