# Plans and agreement preview

Stripe sandbox checkout is now implemented in source. The nine sandbox Price IDs are mapped to Spark's plans and credit packs. Checkout remains unavailable on the public site until the Stripe secret key and webhook signing secret are configured and this version is deployed.

- Plans: Starter $12/month or $120/year, Creator $24/month or $240/year, Pro $49/month or $490/year.
- Monthly allowances: 1,200 / 3,500 / 8,000 Spark Credits, including annually billed plans.
- Packs: $5 for 600, $10 for 1,400, $20 for 3,200. Packs can be used without a subscription; purchased credits carry over.
- Checkout sessions are created on Spark's server. A verified `checkout.session.completed` webhook unlocks the workspace; one-time packs also add an idempotent credit-ledger entry.
- Stripe webhook signatures are checked, duplicate events are ignored, and subscription cancellation can remove access when no purchased credits remain.
- Signup requires the current legal version and records its acceptance timestamp. Existing accounts are not retroactively marked as having accepted.
- Page and project API access require the server-owned workspace_enabled flag, defaulting to zero for existing and new users. There is no client endpoint to set this flag. Deploying this preview will route existing users to plan selection too.

Before accepting live payments, implement actual Spark Credit consumption, monthly credit grants and annual-plan monthly grant scheduling, customer billing management, refunds, and disclosed conversion rates. The current integration is for Stripe sandbox checkout and access testing; it does not yet meter AI usage or grant recurring monthly plan credits.

Policies are California-oriented drafts. The owner requested deferring legal owner identity and support email; neither has been invented. Complete those details, privacy-request handling, retention schedules, cancellation/refund flows, and age/parental-consent requirements before launch. Arrange legal review of the final policies and actual practices; the signup checkbox alone does not establish compliance.

Research references:
- https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business
- https://oag.ca.gov/privacy/ccpa
- https://oag.ca.gov/sites/all/files/agweb/pdfs/cybersecurity/making_your_privacy_practices_public.pdf
- https://developers.openai.com/api/docs/guides/your-data
