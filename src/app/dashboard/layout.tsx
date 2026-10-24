import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { requireStaff } from "@/lib/auth/staff";
import { signOut } from "@/app/dashboard/actions";
import { DashboardNavigation } from "@/components/dashboard/navigation";
import { getLocale, getTranslations } from "next-intl/server";

export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await requireStaff();
  const t = await getTranslations("Navigation");
  const locale = await getLocale();
  const date = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date());

  return (
    <div className="dashboard-frame">
      <DashboardNavigation email={user.email} />
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div><p className="topbar-date">{date}</p><p className="topbar-location">{t("locationLine")} <span>/</span> {t("city")}</p></div>
          <form action={signOut}><button aria-label={t("logout")} className="logout-button"><LogOut size={16} /><span>{t("logout")}</span></button></form>
        </header>
        <main className="dashboard-content">{children}</main>
        <footer className="dashboard-footer"><span>{t("footer")}</span><span>{t("internal")}</span></footer>
      </div>
    </div>
  );
}
