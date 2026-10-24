"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Coffee, LayoutDashboard, UsersRound, UtensilsCrossed } from "lucide-react";

const links = [
  { label: "Übersicht", href: "/dashboard", icon: LayoutDashboard },
  { label: "Reservierungen", href: "/dashboard/reservations", icon: UtensilsCrossed },
  { label: "Gäste", href: "/dashboard/guests", icon: UsersRound },
  { label: "Analysen", href: "/dashboard/analytics", icon: BarChart3 },
];

function Brand() {
  return <Link href="/dashboard" className="group flex items-center gap-3" aria-label="Altstadtliebe Teamübersicht">
    <span className="grid size-10 place-items-center rounded-full bg-[#3c2d24] text-[#f7f4ed] transition group-hover:bg-[#684b37]"><Coffee size={18} strokeWidth={1.7} /></span>
    <span className="text-[16px] font-semibold tracking-[-0.055em] text-[#332920]">altstadtliebe<span className="font-normal text-[#93684c]">.</span><span className="ml-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#989084]">Team</span></span>
  </Link>;
}

export function DashboardNavigation({ email }: { email?: string | null }) {
  const pathname = usePathname();
  return <>
    <aside className="dashboard-sidebar hidden md:flex">
      <Brand />
      <p className="nav-eyebrow">Arbeitsbereich</p>
      <nav className="nav-links" aria-label="Hauptnavigation">
        {links.map(({ label, href, icon: Icon }) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`nav-link${active ? " is-active" : ""}`}>
            <Icon size={17} strokeWidth={1.7} /><span>{label}</span>
          </Link>;
        })}
      </nav>
      <div className="sidebar-bottom">
        <span className="open-indicator"><i /> Heute geöffnet</span>
        <p className="sidebar-location">Lübecker Altstadt · Seit 2018</p>
        {email ? <p className="sidebar-email" title={email}>{email}</p> : null}
      </div>
    </aside>
    <div className="mobile-brand md:hidden"><Brand /></div>
    <nav className="mobile-navigation md:hidden" aria-label="Hauptnavigation">
      {links.map(({ label, href, icon: Icon }) => {
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`mobile-nav-link${active ? " is-active" : ""}`}>
          <Icon size={18} strokeWidth={1.7} /><span>{label}</span>
        </Link>;
      })}
    </nav>
  </>;
}
