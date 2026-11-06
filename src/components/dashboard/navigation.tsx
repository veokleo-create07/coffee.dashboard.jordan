"use client";

import Link from "next/link";
import Image from "next/image";
import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart3, Grid2X2, LayoutDashboard, LogOut, UtensilsCrossed } from "lucide-react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/dashboard/language-switcher";
import { signOut } from "@/app/dashboard/actions";

function Brand() {
  const t = useTranslations("Navigation");
  return <Link href="/dashboard" className="brand-lockup group" aria-label={t("brandLabel")}>
    <Image className="brand-logo-image" src="/altstadtliebe-logo.png" alt="Altstadtliebe breakfast & lunch" width={1254} height={500} priority />
  </Link>;
}

export function DashboardNavigation({ email, notificationControl }: { email?: string | null; notificationControl?: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("Navigation");
  const links = [
    { label: t("overview"), href: "/dashboard", icon: LayoutDashboard },
    { label: t("reservations"), href: "/dashboard/reservations", icon: UtensilsCrossed },
    { label: t("tables"), href: "/dashboard/tables", icon: Grid2X2 },
    { label: t("analytics"), href: "/dashboard/analytics", icon: BarChart3 },
  ];
  return <>
    <aside className="dashboard-sidebar hidden md:flex">
      <Brand />
      <nav className="nav-links" aria-label={t("workspace")}>
        {links.map(({ label, href, icon: Icon }) => {
          const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
          return <Link key={href} href={href} onPointerEnter={() => router.prefetch(href)} onFocus={() => router.prefetch(href)} onTouchStart={() => router.prefetch(href)} aria-current={active ? "page" : undefined} className={`nav-link${active ? " is-active" : ""}`}>
            <Icon size={17} strokeWidth={1.7} /><span>{label}</span>
          </Link>;
        })}
      </nav>
      <div className="sidebar-bottom">
        {notificationControl}
        <div className="sidebar-account-controls"><LanguageSwitcher /><form action={signOut}><button aria-label={t("logout")} className="sidebar-logout"><LogOut size={14} /><span>{t("logout")}</span></button></form></div>
        <span className="open-indicator"><i /> {t("open")}</span>{email ? <p className="sidebar-email" title={email}>{email}</p> : null}
      </div>
    </aside>
    <div className="mobile-brand md:hidden"><Brand /><div className="mobile-account-controls"><LanguageSwitcher />{notificationControl}<form action={signOut}><button aria-label={t("logout")} className="mobile-logout"><LogOut size={16} /></button></form></div></div>
    <nav className="mobile-navigation md:hidden" aria-label={t("workspace")}>
      {links.map(({ label, href, icon: Icon }) => {
        const active = href === "/dashboard" ? pathname === href : pathname.startsWith(href);
        return <Link key={href} href={href} onPointerEnter={() => router.prefetch(href)} onFocus={() => router.prefetch(href)} onTouchStart={() => router.prefetch(href)} aria-current={active ? "page" : undefined} className={`mobile-nav-link${active ? " is-active" : ""}`}>
          <Icon size={18} strokeWidth={1.7} /><span>{label}</span>
        </Link>;
      })}
    </nav>
  </>;
}
