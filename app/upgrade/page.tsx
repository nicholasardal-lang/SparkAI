import PlansView from "../plans-view";
import { pageUser } from "@/lib/spark/server";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function Upgrade() {
  const user = await pageUser();
  if (user.workspace_enabled === 1) redirect("/dashboard");
  return (
    <PlansView signedIn />
  );
}
