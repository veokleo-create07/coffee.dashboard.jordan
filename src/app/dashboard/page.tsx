"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarDays, Clock3, Coffee, Plus, Sparkles, UsersRound } from "lucide-react";
import { MetricCard, PageIntro, PanelHeading, SectionLink } from "@/components/dashboard/primitives";
import { Modal, ReservationForm, Toast, type ReservationInput } from "@/components/dashboard/dialog";
import { mockReservations, type Reservation, type ReservationStatus } from "@/lib/dashboard/mock-data";
import { useLocale, useTranslations } from "next-intl";
import { sampleContentKey } from "@/lib/dashboard/sample-content";

const today = "2026-10-24";
const statusClass: Record<ReservationStatus, string> = {
  confirmed: "status-confirmed", arrived: "status-arrived", seated: "status-seated",
  completed: "status-completed", cancelled: "status-cancelled", "no-show": "status-no-show",
};

export default function DashboardPage() {
  const t = useTranslations("Overview");
  const c = useTranslations("Common");
  const sample = useTranslations("SampleContent");
  const locale = useLocale();
  const statusName = (status: ReservationStatus) => c(({confirmed:"confirmed",arrived:"arrived",seated:"seated",completed:"completed",cancelled:"cancelled","no-show":"noShow"})[status]);
  const sourceName = (source: string) => source === "Telefon" ? c("telephone") : source === "Walk-in" ? c("walkIn") : c("online");
  const noteText = (value: string) => { const key = sampleContentKey(value); return key ? sample(key) : value; };
  const formatDay = (date: string) => date === today ? c("today") : new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "short" }).format(new Date(`${date}T12:00:00`));
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
    setToast(c("mockCreated"));
  }

  return <>
    <PageIntro eyebrow={t("eyebrow")} title={t("title")} description={t("description")} action={<button className="button-primary" onClick={() => setShowNew(true)}><Plus size={15} /><span>{c("newReservation")}</span></button>} />
    <section className="metric-grid" aria-label={t("metrics")}>
      <MetricCard label={t("reservations")} value={todayBookings.length} detail={c("hoursAcrossDay")} change="+2" icon={<CalendarDays size={15} />} />
      <MetricCard label={t("expected")} value={expectedGuests} detail={t("expectedDetail", {count: todayBookings.length})} change="+8 %" icon={<UsersRound size={15} />} tone="sage" />
      <MetricCard label={t("seated")} value={seatedGuests} detail={t("seatedDetail")} icon={<Coffee size={15} />} tone="gold" />
      <MetricCard label={t("capacity")} value={26 - seatedGuests} detail={t("capacityDetail")} icon={<Sparkles size={15} />} tone="stone" />
    </section>

    <div className="capacity-strip"><div className="capacity-copy"><span className="capacity-value">{26 - seatedGuests}<span style={{ color: "#a2aa9b", fontWeight: 400 }}> / 26</span></span><span className="capacity-label">{t("seatsFree")}</span></div><span className="capacity-meta">{t("capacityMeta")}</span></div>

    <section className="overview-grid">
      <article className="panel overview-table">
        <PanelHeading title={t("todayList")} detail={t("todayDetail", {count: todayBookings.length})} action={<SectionLink href="/dashboard/reservations">{t("allBookings")}</SectionLink>} />
        <div className="table-wrap"><table className="data-table">
          <thead><tr><th>{t("tableTime")}</th><th>{t("tableGuest")}</th><th>{t("tablePeople")}</th><th>{t("tableStatus")}</th><th className="hide-mobile">{t("tableSource")}</th></tr></thead>
          <tbody>{todayBookings.slice(0, 7).map((reservation) => <tr key={reservation.id}>
            <td className="time-cell">{reservation.time}</td>
            <td><span className="guest-primary">{reservation.guest}</span>{reservation.note ? <span className="guest-secondary">{noteText(reservation.note)}</span> : null}</td>
            <td>{reservation.guests} <span aria-label={t("guestsShort")} style={{ color: "#aaa194" }}>{c("personShort")}</span></td>
            <td><span className={`status-pill ${statusClass[reservation.status]}`}>{statusName(reservation.status)}</span></td>
            <td className="source-tag hide-mobile">{sourceName(reservation.source)}</td>
          </tr>)}</tbody>
        </table></div>
        <div className="mobile-table-link"><SectionLink href="/dashboard/reservations">{t("openAll")}</SectionLink></div>
      </article>

      <aside className="panel">
        <PanelHeading title={t("upcoming")} detail={t("upcomingDetail")} action={<Clock3 size={15} color="#9a8c7b" />} />
        <div className="upcoming-list">{upcoming.map((reservation, index) => <div key={reservation.id}>
          {index === 0 || reservation.date !== upcoming[index - 1]?.date ? <p className="upcoming-day">{formatDay(reservation.date)}</p> : null}
          <div className="upcoming-item"><span className="upcoming-time">{reservation.time}</span><div><div className="upcoming-name">{reservation.guest}</div><div className="upcoming-meta">{sourceName(reservation.source)}</div></div><span className="upcoming-count">{reservation.guests} {c("personShort")}</span></div>
        </div>)}</div>
        <div className="upcoming-footer"><Link href="/dashboard/reservations">{t("openToday")} <ArrowUpRight size={13} /></Link></div>
      </aside>
    </section>

    <div className="overview-note"><Sparkles size={14} /><span>{t("emptyNote")}</span></div>

    <Modal open={showNew} title={c("newReservation")} subtitle={c("samplePreview")} onClose={() => setShowNew(false)}>
      <ReservationForm onSubmit={addReservation} onCancel={() => setShowNew(false)} submitLabel={t("newMock")} />
    </Modal>
    <Toast message={toast} onDismiss={dismissToast} />
  </>;
}
