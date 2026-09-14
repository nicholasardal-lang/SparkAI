import { env } from "cloudflare:workers";
import { handle, type Runtime } from "@/lib/spark/core";
export const dynamic = "force-dynamic";
const handler = (request: Request) =>
  handle(request, env as unknown as Runtime);
export { handler as GET, handler as POST, handler as PATCH, handler as DELETE };
