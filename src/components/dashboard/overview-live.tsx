"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowUpRight, CalendarDays, Clock3, UsersRound } from "lucide-react";
import { MetricCard, PageIntro, PanelHeading, SectionLink } from "@/components/dashboard/primitives";
import { loadCurrentOccupancy, loadReservations, type LiveReservation, type OccupancyResult, type ReservationLoadResult } from "@/app/dashboard/actions";
import { useLocale, useTranslations } from "next-intl";

const statusClass: Record<LiveReservation["status"], string> = {
  pending: "status-pending", confirmed: "status-confirmed", arrived: "status-arrived", cancelled: "status-cancelled", completed: "status-completed", no_show: "status-no-show",
};
function dateAfter(date: string, days: number) {
  const end = new Date(`${date}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + days);
  return end.toISOString().slice(0, 10);
}
function isLate(reservation: LiveReservation, now: number) {
  const scheduled = Date.parse(reservation.startsAt);
  if (reservation.arrivedAt) return Date.parse(reservation.arrivedAt) > scheduled + 15 * 60_000;
  return (reservation.status === "pending" || reservation.status === "confirmed") && now > scheduled + 15 * 60_000;
}

export function OverviewLive({ today, initial, initialOccupancy }: { today: string; initial: ReservationLoadResult; initialOccupancy: OccupancyResult }) {
  const t = useTranslations("Overview"); const c = useTranslations("Common"); const locale = useLocale();
  const [reservationsResult, setReservationsResult] = useState(initial);
  const [occupancy, setOccupancy] = useState(initialOccupancy);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const [nextReservations, nextOccupancy] = await Promise.all([
        loadReservations(today, dateAfter(today, 6)),
        loadCurrentOccupancy(),
      ]);
      if (!active) return;
      setReservationsResult(nextReservations); setOccupancy(nextOccupancy);
    };
    const interval = window.setInterval(() => { void refresh(); }, 15_000);
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => { active = false; window.clearInterval(interval); window.clearInterval(clock); };
  }, [today]);

  const dateLabel = (date: string) => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date(`${date}T12:00:00Z`));
  const statusLabel = (status: LiveReservation["status"]) => c(status === "no_show" ? "noShow" : status);
  const reservations = reservationsResult.ok ? reservationsResult.reservations : [];
  const todayBookings = reservations.filter((reservation) => reservation.date === today);
  const expectedBookings = todayBookings.filter((reservation) => reservation.status === "pending" || reservation.status === "confirmed");
  const expectedGuests = expectedBookings.reduce((sum, reservation) => sum + reservation.guests, 0);
  const seatedGuests = occupancy.ok ? occupancy.guests : null;
  const freeSeats = seatedGuests === null ? null : Math.max(0, 26 - seatedGuests);
  const upcoming = reservations.filter((reservation) => (reservation.startsAt >= new Date(now).toISOString()) && (reservation.status === "pending" || reservation.status === "confirmed")).slice(0, 5);
  const errorText = reservationsResult.ok ? "" : reservationsResult.reason === "unauthorized" ? c("reservationUnauthorized") : reservationsResult.reason === "permission" ? c("reservationPermission") : c("reservationLoadError");
  const occupancyError = !occupancy.ok ? occupancy.reason === "unauthorized" ? c("reservationUnauthorized") : occupancy.reason === "permission" ? c("reservationPermission") : c("occupancyLoadError") : "";

  return <>
    <PageIntro eyebrow="" title={t("title")} description={dateLabel(today)} />
    {!reservationsResult.ok ? <div className="live-data-alert" role="alert">{errorText}</div> : null}
    {occupancyError ? <div className="live-data-alert occupancy-alert" role="alert">{occupancyError}</div> : null}
    <section className="metric-grid" aria-label={t("metrics")}>
      <MetricCard label={t("reservations")} value={reservationsResult.ok ? todayBookings.length : "—"} detail={t("liveDataLabel")} icon={<CalendarDays size={15} />} />
      <MetricCard label={t("expected")} value={reservationsResult.ok ? expectedGuests : "—"} detail={t("expectedDetail", { count: expectedBookings.length })} icon={<UsersRound size={15} />} tone="sage" />
      <MetricCard label={t("seated")} value={seatedGuests ?? "—"} detail={t("occupancyLiveDetail")} icon={<UsersRound size={15} />} tone="gold" />
      <MetricCard label={t("capacity")} value={freeSeats ?? "—"} detail={t("capacityDetail")} icon={<Clock3 size={15} />} tone="stone" />
    </section>

    <section className="overview-grid">
      <article className="panel overview-table">
        <PanelHeading title={t("todayList")} detail={t("todayDetail", { count: todayBookings.length })} action={<SectionLink href="/dashboard/reservations">{t("allBookings")}</SectionLink>} />
        {reservationsResult.ok && todayBookings.length ? <div className="table-wrap"><table className="data-table">
          <thead><tr><th>{t("tableTime")}</th><th>{t("tableGuest")}</th><th>{t("tablePeople")}</th><th>{t("tableStatus")}</th><th className="hide-mobile">{t("tableReference")}</th><th className="hide-mobile">{t("tableSource")}</th></tr></thead>
          <tbody>{todayBookings.slice(0, 8).map((reservation) => <tr key={reservation.id}>
            <td className="time-cell">{reservation.time}</td><td><span className="guest-primary">{reservation.guest}</span>{reservation.note ? <span className="guest-secondary">{reservation.note}</span> : null}</td>
            <td>{new Intl.NumberFormat(locale).format(reservation.guests)} <span style={{ color: "#aaa194" }}>{c("personShort")}</span></td>
            <td><span className={`status-pill ${statusClass[reservation.status]}`}>{statusLabel(reservation.status)}</span>{isLate(reservation, now) ? <span className="late-pill">{t("lateFlag")}</span> : null}</td><td className="source-tag hide-mobile">{reservation.reference}</td><td className="hide-mobile">{reservation.source === "website" ? c("online") : reservation.source === "phone" ? c("telephone") : c("walkIn")}</td>
          </tr>)}</tbody>
        </table></div> : reservationsResult.ok ? <p className="live-empty-state">{t("noTodayReservations")}</p> : null}
        <div className="mobile-table-link"><SectionLink href="/dashboard/reservations">{t("openAll")}</SectionLink></div>
      </article>

      <aside className="panel">
        <PanelHeading title={t("upcoming")} detail={t("upcomingDetail")} action={<Clock3 size={15} color="#9a8c7b" />} />
        {!reservationsResult.ok ? <p className="live-empty-state">{errorText}</p> : upcoming.length ? <div className="upcoming-list">{upcoming.map((reservation, index) => <div key={reservation.id}>
          {index === 0 || reservation.date !== upcoming[index - 1]?.date ? <p className="upcoming-day">{dateLabel(reservation.date)}</p> : null}
          <div className="upcoming-item"><span className="upcoming-time">{reservation.time}</span><div><div className="upcoming-name">{reservation.guest}</div><div className="upcoming-meta">{reservation.reference}</div></div><span className="upcoming-count">{reservation.guests} {c("personShort")}</span></div>
        </div>)}</div> : <p className="live-empty-state">{t("noUpcomingReservations")}</p>}
        <div className="upcoming-footer"><Link href="/dashboard/reservations">{t("openToday")} <ArrowUpRight size={13} /></Link></div>
      </aside>
    </section>
  </>;
}
