import PlansView from "../plans-view";
import { pageUser } from "@/lib/spark/server";
import { redirect } from "next/navigation";
import { env } from "cloudflare:workers";
import type { Runtime } from "@/lib/spark/core";

export const dynamic = "force-dynamic";

export default async function Upgrade() {
  const user = await pageUser();
  if (user.workspace_enabled === 1) redirect("/dashboard");
  const configured = Number((env as unknown as Runtime).LOCAL_PREVIEW_CREDITS || 0);
  const previewCredits = Number.isSafeInteger(configured) && configured > 0
    ? Math.min(configured, 100_000)
    : 0;
  return (
    <PlansView signedIn previewCredits={previewCredits} />
  );
}
