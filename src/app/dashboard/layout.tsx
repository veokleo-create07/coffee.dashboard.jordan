import type { ReactNode } from "react";
import { requireStaff } from "@/lib/auth/staff";
import { DashboardNavigation } from "@/components/dashboard/navigation";
import { PushNotifications } from "@/components/dashboard/push-notifications";

export default async function DashboardLayout({ children }: Readonly<{ children: ReactNode }>) {
  const user = await requireStaff();

  return (
    <div className="dashboard-frame">
      <DashboardNavigation email={user.email} notificationControl={<PushNotifications />} />
      <div className="dashboard-main">
        <main className="dashboard-content">{children}</main>
      </div>
    </div>
  );
}
