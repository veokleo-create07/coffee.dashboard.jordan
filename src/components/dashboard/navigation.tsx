"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Heart, LayoutDashboard, UsersRound, UtensilsCrossed } from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/dashboard/language-switcher";

function Brand() {
  const t = useTranslations("Navigation");
  return <Link href="/dashboard" className="brand-lockup group" aria-label={t("brandLabel")}>
    <Heart className="brand-heart" size={12} strokeWidth={1.8} fill="currentColor" />
    <span className="brand-wordmark">Altstadtliebe</span>
    <span className="brand-team">{t("team")}</span>
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
      <p className="nav-eyebrow">{t("workspace")}</p>
      <LanguageSwitcher />
      <nav className="nav-links" aria-label={t("workspace")}>
        {links.map(({ label, href, icon: Icon }) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={`nav-link${active ? " is-active" : ""}`}>
            <Icon size={17} strokeWidth={1.7} /><span>{label}</span>
          </Link>;
        })}
      </nav>
      <div className="sidebar-bottom">
        <span className="open-indicator"><i /> {t("open")}</span>
        <p className="sidebar-location">{t("location")}</p>
        {email ? <p className="sidebar-email" title={email}>{email}</p> : null}
      </div>
    </aside>
    <div className="mobile-brand md:hidden"><Brand /><LanguageSwitcher /></div>
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
