import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { userFor, type Runtime } from "./core";
import { balance } from "./billing";
export async function pageUser(requireWorkspace = false) {
  const db = (env as unknown as Runtime).DB;
  const jar = await cookies();
  const user = db
    ? await userFor(
        `spark_session=${jar.get("spark_session")?.value || ""}`,
        db,
        (env as unknown as Runtime).REQUIRE_EMAIL_VERIFICATION === "true",
      )
    : null;
  if (!user) redirect("/login");
  const billing=await balance(env as unknown as Runtime,user.id);
  user.workspace_enabled=billing.active||billing.credits>0?1:0;
  user.billing=billing;
  if (requireWorkspace && user.workspace_enabled !== 1) redirect("/upgrade");
  return user;
}
