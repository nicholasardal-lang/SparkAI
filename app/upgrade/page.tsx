import PlansView from "../plans-view";
import { pageUser } from "@/lib/spark/server";

export const dynamic = "force-dynamic";

export default async function Upgrade() {
  await pageUser();
  return (
    <PlansView signedIn />
  );
}
