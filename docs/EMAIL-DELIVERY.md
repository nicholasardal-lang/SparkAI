# Spark account email setup

Spark sends verification and password-recovery links through Resend. The token and account flows are implemented in the app; no mail is sent until the hosting environment is configured.

1. Add `sparkyourgame.com` as a sending domain in Resend. Use Resend's Cloudflare connection if offered, or add exactly the DNS records displayed by Resend in Cloudflare. Wait until Resend reports the domain verified.
2. Create a Resend API key with **Sending access**, restricted to `sparkyourgame.com` if available. Store it only as the private `RESEND_API_KEY` hosting secret. Never commit or paste it into a chat.
3. Set `EMAIL_FROM=Spark <noreply@sparkyourgame.com>` and confirm `APP_ORIGIN=https://sparkyourgame.com` in the same hosting environment. Leave `REQUIRE_EMAIL_VERIFICATION=false` for the first delivery test.
4. Use a real test account and inbox to request a password reset at `/forgot-password`. Confirm that the message arrives, the link opens the correct domain, the password changes, and the old password and sessions stop working. Test `/verify-email` with an unverified test account and confirm that a resend message arrives and the link works once.
5. Once delivery works, set `REQUIRE_EMAIL_VERIFICATION=true`. Test a new signup and login, including resending a verification link. Existing unverified accounts will also need to verify when this setting is enabled.

Verification links expire after 24 hours and reset links after one hour. Requesting a new link invalidates older links only after the new email is accepted by the provider. Both request endpoints are rate limited and return the same success body for existing and unknown addresses. Check Resend delivery logs if a message is not received; a successful API response alone does not prove inbox delivery.
