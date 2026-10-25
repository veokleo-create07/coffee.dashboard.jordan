import { loadReservations } from "@/app/dashboard/actions";
import { ReservationsLive } from "@/components/dashboard/reservations-live";

export const dynamic = "force-dynamic";

function todayInBerlin() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export default async function ReservationsPage({ searchParams }: { searchParams?: Promise<{ date?: string; reservation?: string }> }) {
  const today = todayInBerlin();
  const params = await searchParams;
  const requestedDate = params?.date;
  const requestedReservation = params?.reservation;
  const initialDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today;
  // Load only the first visible day. Week and month views fetch their broader
  // ranges on demand in the client, keeping the initial route response small.
  const initial = await loadReservations(initialDate, initialDate);
  return <ReservationsLive today={today} initialStart={initialDate} initialEnd={initialDate} initial={initial} initialDate={initialDate} initialReservationId={requestedReservation} />;
}
