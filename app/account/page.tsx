import { pageUser } from "@/lib/spark/server";
import AccountView from "./view";
export const dynamic="force-dynamic";
export default async function Page(){const user=await pageUser();return <AccountView user={user}/>;}
