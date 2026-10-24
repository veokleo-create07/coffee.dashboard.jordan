import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { requireStaff } from "@/lib/auth/staff";
import { signOut } from "@/app/dashboard/actions";
import { DashboardNavigation } from "@/components/dashboard/navigation";

export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await requireStaff();

  return (
    <div className="dashboard-frame">
      <DashboardNavigation email={user.email} />
      <div className="dashboard-main">
        <header className="dashboard-topbar">
          <div><p className="topbar-date">Samstag, 24. Oktober 2026</p><p className="topbar-location">Altstadtliebe <span>/</span> Lübeck</p></div>
          <form action={signOut}><button aria-label="Abmelden" className="logout-button"><LogOut size={16} /><span>Abmelden</span></button></form>
        </header>
        <main className="dashboard-content">{children}</main>
        <footer className="dashboard-footer"><span>Mit Liebe in Lübeck.</span><span>ALTSTADTLIEBE · INTERN</span></footer>
      </div>
    </div>
  );
}
