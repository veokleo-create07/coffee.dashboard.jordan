import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth/staff";
import { DashboardNavigation } from "@/components/dashboard/navigation";

export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await requireStaff();

  return (
    <div className="dashboard-frame">
      <DashboardNavigation email={user.email} />
      <div className="dashboard-main">
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
