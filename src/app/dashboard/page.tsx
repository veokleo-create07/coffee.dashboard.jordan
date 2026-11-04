import { getOverviewReservations } from "@/app/dashboard/actions";
import { OverviewLive } from "@/components/dashboard/overview-live";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { today, initialEnd, result, occupancy } = await getOverviewReservations();
  return <OverviewLive today={today} initialEnd={initialEnd} initial={result} initialOccupancy={occupancy} />;
}
