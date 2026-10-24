"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Heart, LayoutDashboard, UsersRound, UtensilsCrossed } from "lucide-react";

const links = [
  { label: "Übersicht", href: "/dashboard", icon: LayoutDashboard },
  { label: "Reservierungen", href: "/dashboard/reservations", icon: UtensilsCrossed },
  { label: "Gäste", href: "/dashboard/guests", icon: UsersRound },
  { label: "Analysen", href: "/dashboard/analytics", icon: BarChart3 },
];

function Brand() {
  return <Link href="/dashboard" className="brand-lockup group" aria-label="Altstadtliebe Teamübersicht">
    <Heart className="brand-heart" size={12} strokeWidth={1.8} fill="currentColor" />
    <span className="brand-wordmark">Altstadtliebe</span>
    <span className="brand-team">Team Dashboard</span>
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
