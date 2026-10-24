"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Clock3, Coffee, Plus, Sparkles, UsersRound } from "lucide-react";
import { MetricCard, PageIntro, PanelHeading, SectionLink } from "@/components/dashboard/primitives";
import { Modal, ReservationForm, Toast, type ReservationInput } from "@/components/dashboard/dialog";
import { mockReservations, statusLabels, type Reservation, type ReservationStatus } from "@/lib/dashboard/mock-data";

const today = "2026-10-24";
const statusClass: Record<ReservationStatus, string> = {
  confirmed: "status-confirmed", arrived: "status-arrived", seated: "status-seated",
  completed: "status-completed", cancelled: "status-cancelled", "no-show": "status-no-show",
};

function formatDay(date: string) {
  if (date === today) return "Heute";
  return new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
}

export default function DashboardPage() {
  const [reservations, setReservations] = useState(mockReservations);
  const [showNew, setShowNew] = useState(false);
  const [toast, setToast] = useState("");
  const dismissToast = useCallback(() => setToast(""), []);
  const todayBookings = useMemo(() => reservations.filter((reservation) => reservation.date === today && reservation.status !== "cancelled"), [reservations]);
  const expectedGuests = todayBookings.reduce((sum, reservation) => sum + reservation.guests, 0);
  const seatedGuests = todayBookings.filter((reservation) => reservation.status === "seated").reduce((sum, reservation) => sum + reservation.guests, 0);
  const upcoming = reservations.filter((reservation) => reservation.date >= today && reservation.status === "confirmed").slice(0, 5);

  function addReservation(values: ReservationInput) {
    const reservation: Reservation = { ...values, id: `AL-${values.date.slice(8)}${values.date.slice(5, 7)}-${Date.now().toString().slice(-4)}`, status: "confirmed" };
    setReservations((current) => [...current, reservation].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)));
    setShowNew(false);
    setToast("Reservierung als Mock angelegt.");
  }

  return <>
    <PageIntro eyebrow="Samstag, 24. Oktober 2026" title="Guten Morgen, Team." description="Ein klarer Blick auf den heutigen Café-Alltag." action={<button className="button-primary" onClick={() => setShowNew(true)}><Plus size={15} /><span>Neue Reservierung</span></button>} />
    <section className="metric-grid" aria-label="Kennzahlen für heute">
      <MetricCard label="Reservierungen heute" value={todayBookings.length} detail="über den ganzen Tag" change="+2 ggü. letzter Woche" icon={<CalendarDays size={15} />} />
      <MetricCard label="Erwartete Gäste" value={expectedGuests} detail={`in ${todayBookings.length} Reservierungen`} change="+8 % zur Vorwoche" icon={<UsersRound size={15} />} tone="sage" />
      <MetricCard label="Gerade am Tisch" value={seatedGuests} detail="von 26 Plätzen" icon={<Coffee size={15} />} tone="gold" />
      <MetricCard label="Kapazität verfügbar" value={26 - seatedGuests} detail="Plätze aktuell frei · 26 gesamt" icon={<Sparkles size={15} />} tone="stone" />
    </section>

    <div className="capacity-strip"><div className="capacity-copy"><span className="capacity-value">{26 - seatedGuests}<span style={{ color: "#a2aa9b", fontWeight: 400 }}> / 26</span></span><span className="capacity-label">Plätze frei im Moment</span></div><span className="capacity-meta">Zuletzt aktualisiert · Mock-Daten</span></div>

    <section className="overview-grid">
      <article className="panel overview-table">
        <PanelHeading title="Reservierungen heute" detail={`${todayBookings.length} Buchungen · Samstag`} action={<SectionLink href="/dashboard/reservations">Alle ansehen</SectionLink>} />
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>Uhrzeit</th><th>Gast</th><th>Personen</th><th>Status</th><th className="hide-mobile">Quelle</th></tr></thead>
          <tbody>{todayBookings.slice(0, 7).map((reservation) => <tr key={reservation.id}>
            <td className="time-cell">{reservation.time}</td>
            <td><span className="guest-primary">{reservation.guest}</span>{reservation.note ? <span className="guest-secondary">Notiz hinterlegt</span> : null}</td>
            <td>{reservation.guests} <span aria-label="Gäste" style={{ color: "#aaa194" }}>Pers.</span></td>
            <td><span className={`status-pill ${statusClass[reservation.status]}`}>{statusLabels[reservation.status]}</span></td>
            <td className="source-tag hide-mobile">{reservation.source}</td>
          </tr>)}</tbody>
        </table></div>
        <div className="mobile-table-link"><SectionLink href="/dashboard/reservations">Reservierungen öffnen</SectionLink></div>
      </article>

      <aside className="panel">
        <PanelHeading title="Demnächst" detail="Die nächsten Buchungen" action={<Clock3 size={15} color="#9a8c7b" />} />
        <div className="upcoming-list">{upcoming.map((reservation, index) => <div key={reservation.id}>
          {index === 0 || reservation.date !== upcoming[index - 1]?.date ? <p className="upcoming-day">{formatDay(reservation.date)}</p> : null}
          <div className="upcoming-item"><span className="upcoming-time">{reservation.time}</span><div><div className="upcoming-name">{reservation.guest}</div><div className="upcoming-meta">{reservation.source}</div></div><span className="upcoming-count">{reservation.guests} Pers.</span></div>
        </div>)}</div>
        <div className="upcoming-footer"><Link href="/dashboard/reservations">Tagesplan öffnen <ArrowUpRight size={13} /></Link></div>
      </aside>
    </section>

    <div className="overview-note"><Sparkles size={14} /><span>Guten Start in den Tag. Deine Zahlen hier sind Beispieldaten und werden noch nicht gespeichert.</span></div>

    <Modal open={showNew} title="Neue Reservierung" subtitle="Mock-Eintrag für die lokale UI-Vorschau" onClose={() => setShowNew(false)}>
      <ReservationForm onSubmit={addReservation} onCancel={() => setShowNew(false)} submitLabel="Mock-Reservierung anlegen" />
    </Modal>
    <Toast message={toast} onDismiss={dismissToast} />
  </>;
}
