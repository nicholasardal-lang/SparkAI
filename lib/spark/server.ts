import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { userFor, type Runtime } from "./core";
export async function pageUser(requireWorkspace = false) {
  const db = (env as unknown as Runtime).DB;
  const jar = await cookies();
  const user = db
    ? await userFor(
        `spark_session=${jar.get("spark_session")?.value || ""}`,
        db,
      )
    : null;
  if (!user) redirect("/login");
  if (requireWorkspace && user.workspace_enabled !== 1) redirect("/upgrade");
  return user;
}
