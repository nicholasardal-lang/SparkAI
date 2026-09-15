"use client";

import { LogoMark } from "@/components/brand";
import { ArrowUpRight, ChevronDown, Compass, CreditCard, Coins, MessageCircle, BookOpen, Radio, Zap, Layers } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";

const menus = [
  { title: "Explore", items: [
    { title: "Try the workspace", detail: "Start with your next game idea", href: "/#workspace", icon: Zap },
    { title: "How Spark works", detail: "From first idea to your next build", href: "/#how", icon: Compass },
    { title: "What you can build", detail: "Planning, Luau scripts, and debugging", href: "/#features", icon: Layers },
  ] },
  { title: "Plans", items: [
    { title: "Compare plans", detail: "Find your fit: Starter, Creator, or Pro", href: "/pricing", icon: CreditCard },
    { title: "Spark Credits", detail: "Explore packs and extra usage", href: "/pricing#credits", icon: Coins },
  ] },
  { title: "Community", items: [
    { title: "Discord", detail: "Meet fellow Roblox creators", icon: MessageCircle },
    { title: "Spark blog", detail: "Ideas, updates, and building guides", icon: BookOpen },
    { title: "Social channels", detail: "Follow what’s next for Spark", icon: Radio },
  ] },
];

export default function SiteNav() {
  return <nav className="nav site-nav" aria-label="Main navigation">
    <a className="brand" href="/" aria-label="Spark home"><LogoMark /><span>Spark</span></a>
    <div className="site-nav-menus">
      {menus.map(menu => <DropdownMenu key={menu.title} modal={false}>
        <DropdownMenuTrigger className="nav-menu-trigger">{menu.title}<ChevronDown size={14} aria-hidden="true" /></DropdownMenuTrigger>
        <DropdownMenuContent className="nav-menu-panel" sideOffset={12} align="start" collisionPadding={14}>
          <div className="nav-menu-heading">{menu.title === "Community" ? "BETTER TOGETHER" : menu.title === "Plans" ? "MAKE ROOM TO CREATE" : "YOUR NEXT BUILD STARTS HERE"}</div>
          {menu.items.map(item => "href" in item ? <DropdownMenuItem key={item.title} asChild className="nav-menu-item">
            <a href={item.href}><item.icon aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.detail}</small></span><ArrowUpRight className="nav-menu-arrow" aria-hidden="true" /></a>
          </DropdownMenuItem> : <DropdownMenuItem key={item.title} disabled className="nav-menu-item">
            <item.icon aria-hidden="true" /><span><strong>{item.title}</strong><small>{item.detail}</small></span><span className="nav-soon">Coming soon</span>
          </DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>)}
    </div>
    <div className="site-nav-actions"><a href="/login">Log in</a><a className="button" href="/signup">Get started <ArrowUpRight size={16} /></a></div>
  </nav>;
}
