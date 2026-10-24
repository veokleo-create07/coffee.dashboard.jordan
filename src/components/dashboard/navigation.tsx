"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Heart, LayoutDashboard, LogOut, UsersRound, UtensilsCrossed } from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/dashboard/language-switcher";
import { signOut } from "@/app/dashboard/actions";

function Brand() {
  const t = useTranslations("Navigation");
  return <Link href="/dashboard" className="brand-lockup group" aria-label={t("brandLabel")}>
    <Heart className="brand-heart" size={12} strokeWidth={1.8} fill="currentColor" />
    <span className="brand-wordmark">Altstadtliebe</span>
    <span className="brand-team">breakfast &amp; lunch</span>
  </Link>;
}

export function DashboardNavigation({ email }: { email?: string | null }) {
  const pathname = usePathname();
  const t = useTranslations("Navigation");
  const links = [
    { label: t("overview"), href: "/dashboard", icon: LayoutDashboard },
    { label: t("reservations"), href: "/dashboard/reservations", icon: UtensilsCrossed },
    { label: t("guests"), href: "/dashboard/guests", icon: UsersRound },
    { label: t("analytics"), href: "/dashboard/analytics", icon: BarChart3 },
  ];
  return <>
    <aside className="dashboard-sidebar hidden md:flex">
      <Brand />
      <nav className="nav-links" aria-label={t("workspace")}>
        {links.map(({ label, href, icon: Icon }) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`nav-link${active ? " is-active" : ""}`}>
            <Icon size={17} strokeWidth={1.7} /><span>{label}</span>
          </Link>;
        })}
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-account-controls"><LanguageSwitcher /><form action={signOut}><button aria-label={t("logout")} className="sidebar-logout"><LogOut size={14} /><span>{t("logout")}</span></button></form></div>
        <span className="open-indicator"><i /> {t("open")}</span>{email ? <p className="sidebar-email" title={email}>{email}</p> : null}
      </div>
    </aside>
    <div className="mobile-brand md:hidden"><Brand /><div className="mobile-account-controls"><LanguageSwitcher /><form action={signOut}><button aria-label={t("logout")} className="mobile-logout"><LogOut size={16} /></button></form></div></div>
    <nav className="mobile-navigation md:hidden" aria-label={t("workspace")}>
      {links.map(({ label, href, icon: Icon }) => {
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`mobile-nav-link${active ? " is-active" : ""}`}>
          <Icon size={18} strokeWidth={1.7} /><span>{label}</span>
        </Link>;
      })}
    </nav>
  </>;
}
