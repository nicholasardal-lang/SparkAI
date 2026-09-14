# Plans and agreement preview

This is the payment-preview implementation approved for publication. Checkout remains disabled until payment processing is connected.

- Plans: Starter $12/month or $120/year, Creator $24/month or $240/year, Pro $49/month or $490/year.
- Monthly allowances: 1,200 / 3,500 / 8,000 Spark Credits, including annually billed plans.
- Packs: $5 for 600, $10 for 1,400, $20 for 3,200. Packs can be used without a subscription; purchased credits carry over.
- Checkout is a preview only. Selecting an offer never grants access or charges money.
- Signup requires the current legal version and records its acceptance timestamp. Existing accounts are not retroactively marked as having accepted.
- Page and project API access require the server-owned workspace_enabled flag, defaulting to zero for existing and new users. There is no client endpoint to set this flag. Deploying this preview will route existing users to plan selection too.

Before enabling paid use, replace preview access provisioning with verified Stripe events and implement subscription lifecycle handling, a transactional credit ledger, request cost reservation/reconciliation, and disclosed conversion rates. Do not simply enable accounts permanently on the first payment. There is no live credit metering or payment processing in this change.

Policies are California-oriented drafts. The owner requested deferring legal owner identity and support email; neither has been invented. Complete those details, privacy-request handling, retention schedules, cancellation/refund flows, and age/parental-consent requirements before launch. Arrange legal review of the final policies and actual practices; the signup checkbox alone does not establish compliance.

Research references:
- https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business
- https://oag.ca.gov/privacy/ccpa
- https://oag.ca.gov/sites/all/files/agweb/pdfs/cybersecurity/making_your_privacy_practices_public.pdf
- https://developers.openai.com/api/docs/guides/your-data
