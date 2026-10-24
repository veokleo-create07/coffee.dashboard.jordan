import { loadReservations } from "@/app/dashboard/actions";
import { ReservationsLive } from "@/components/dashboard/reservations-live";

export const dynamic = "force-dynamic";

function todayInBerlin() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export default async function ReservationsPage({ searchParams }: { searchParams?: Promise<{ date?: string }> }) {
  const today = todayInBerlin();
  const monthStart = `${today.slice(0, 7)}-01`;
  const next = new Date(`${today.slice(0, 7)}-15T12:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1, 0);
  const monthEnd = next.toISOString().slice(0, 10);
  const initial = await loadReservations(monthStart, monthEnd);
  const requestedDate = (await searchParams)?.date;
  const initialDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today;
  return <ReservationsLive today={today} initialStart={monthStart} initialEnd={monthEnd} initial={initial} initialDate={initialDate} />;
}
