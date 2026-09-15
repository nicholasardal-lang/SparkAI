"use client";
import { useEffect, useState } from "react";
import { User, Settings, Shield, CreditCard, LogOut } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { api } from "./auth-form";
import ProfileAvatar from "./profile-avatar";
export default function AccountMenu() {
  const [user,setUser]=useState<any>(null), [error,setError]=useState("");
  useEffect(()=>{api("me").then(r=>setUser(r.user)).catch(()=>setError("Account menu could not load. Refresh to retry."));},[]);
  return <div className="account-control"><DropdownMenu><DropdownMenuTrigger aria-label="Open account menu" className="account-trigger"><ProfileAvatar username={user?.username} color={user?.avatar_color} /><span>{user?.username || "Your account"}</span></DropdownMenuTrigger><DropdownMenuContent align="end" className="account-dropdown"><DropdownMenuLabel>{user?.username || "Choose your username"}</DropdownMenuLabel><DropdownMenuSeparator/>{[["Profile","profile",User],["Settings","settings",Settings],["Manage subscription","billing",CreditCard],["Security","security",Shield]].map(([label,tab,Icon]:any)=><DropdownMenuItem key={tab} asChild><a href={"/account?tab="+tab}><Icon size={16}/>{label}</a></DropdownMenuItem>)}<DropdownMenuSeparator/><DropdownMenuItem onSelect={async()=>{try{await api("auth/logout","POST",{});location.assign("/");}catch{setError("Could not sign out. Please retry.");}}}><LogOut size={16}/>Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu>{error&&<small role="alert">{error}</small>}</div>;
}
