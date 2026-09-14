import { pageUser } from "@/lib/spark/server";
import Dashboard from "./view";
export const dynamic = "force-dynamic";
export default async function Page() {
  const user = await pageUser(true);
  return <Dashboard email={user.email} />;
}
