import { loadAnalytics } from "@/app/dashboard/actions";
import AnalyticsLive from "@/components/dashboard/analytics-live";

export default async function AnalyticsPage() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date());
  const initial = await loadAnalytics("month", today);
  return <AnalyticsLive initial={initial} />;
}
