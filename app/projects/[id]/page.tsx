import { pageUser } from "@/lib/spark/server";
import Workspace from "./view";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await pageUser(true);
  const { id } = await params;
  return <Workspace id={id} />;
}
