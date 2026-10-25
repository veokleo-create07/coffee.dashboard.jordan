import { loadReservations } from "@/app/dashboard/actions";
import { ReservationsLive } from "@/components/dashboard/reservations-live";

export const dynamic = "force-dynamic";

function todayInBerlin() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function weekBounds(dateKey: string) {
  const date = new Date(`${dateKey}T12:00:00Z`);
  const day = date.getUTCDay();
  const mondayOffset = (day + 6) % 7;
  const start = new Date(date);
  start.setUTCDate(date.getUTCDate() - mondayOffset);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  const format = (value: Date) => value.toISOString().slice(0, 10);
  return { start: format(start), end: format(end) };
}

export default async function ReservationsPage({ searchParams }: { searchParams?: Promise<{ date?: string; reservation?: string }> }) {
  const today = todayInBerlin();
  const params = await searchParams;
  const requestedDate = params?.date;
  const requestedReservation = params?.reservation;
  const initialDate = requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate) ? requestedDate : today;
  // Load the selected week once so moving between adjacent days is immediate.
  // Wider month ranges still load on demand in the client.
  const initialRange = weekBounds(initialDate);
  const initial = await loadReservations(initialRange.start, initialRange.end);
  return <ReservationsLive today={today} initialStart={initialRange.start} initialEnd={initialRange.end} initial={initial} initialDate={initialDate} initialReservationId={requestedReservation} />;
}
