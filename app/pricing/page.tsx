import PlansView from "../plans-view";
import { env } from "cloudflare:workers";
import { cookies } from "next/headers";
import { userFor,type Runtime } from "@/lib/spark/core";
export const dynamic="force-dynamic";
export default async function Pricing() {
  const jar=await cookies();
  const user=await userFor(`spark_session=${jar.get("spark_session")?.value||""}`,(env as unknown as Runtime).DB);
  return <PlansView signedIn={!!user}/>;
}
