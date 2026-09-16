import ForgotPassword from "./view";
import { env } from "cloudflare:workers";
import type { Runtime } from "@/lib/spark/core";
export const dynamic="force-dynamic";
export default function Page(){const config=env as unknown as Runtime;return config.RESEND_API_KEY&&config.EMAIL_FROM?<ForgotPassword/>:<main className="auth-card"><a className="brand" href="/">✦ Spark</a><h1>Password recovery is coming soon.</h1><p>Email delivery is not available yet. You can still sign in with your email and password; email verification is not required.</p><a className="button" href="/login">Back to login</a></main>;}
