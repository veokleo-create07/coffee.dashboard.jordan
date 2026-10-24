"use client";

import Link from "next/link";
import { ArrowUpRight, CalendarDays, Clock3, UsersRound } from "lucide-react";
import { MetricCard, PageIntro, PanelHeading, SectionLink } from "@/components/dashboard/primitives";
import type { LiveReservation, ReservationLoadResult } from "@/app/dashboard/actions";
import { useLocale, useTranslations } from "next-intl";

const statusClass: Record<LiveReservation["status"], string> = {
  pending: "status-pending", confirmed: "status-confirmed", arrived: "status-arrived", cancelled: "status-cancelled", completed: "status-completed", no_show: "status-no-show",
};

export function OverviewLive({ today, initial }: { today: string; initial: ReservationLoadResult }) {
  const t = useTranslations("Overview");
  const c = useTranslations("Common");
  const locale = useLocale();
  const dateLabel = (date: string) => new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Berlin" }).format(new Date(`${date}T12:00:00Z`));
  const statusLabel = (status: LiveReservation["status"]) => c(status === "no_show" ? "noShow" : status);
  const reservations = initial.ok ? initial.reservations : [];
  const todayBookings = reservations.filter((reservation) => reservation.date === today);
  const activeToday = todayBookings.filter((reservation) => ["pending", "confirmed", "arrived"].includes(reservation.status));
  const expectedGuests = activeToday.reduce((sum, reservation) => sum + reservation.guests, 0);
  const pending = todayBookings.filter((reservation) => reservation.status === "pending").length;
  const currentTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());
  const upcoming = reservations.filter((reservation) => (reservation.date > today || (reservation.date === today && reservation.time >= currentTime)) && (["pending", "confirmed", "arrived"].includes(reservation.status))).slice(0, 5);
  const errorText = initial.ok ? "" : initial.reason === "unauthorized" ? c("reservationUnauthorized") : initial.reason === "permission" ? c("reservationPermission") : c("reservationLoadError");

  return <>
    <PageIntro eyebrow={dateLabel(today)} title={t("title")} description={t("description")} />
    {!initial.ok ? <div className="live-data-alert" role="alert">{errorText}</div> : null}
    <section className="metric-grid" aria-label={t("metrics")}>
      <MetricCard label={t("reservations")} value={initial.ok ? todayBookings.length : "—"} detail={t("liveDataLabel")} icon={<CalendarDays size={15} />} />
      <MetricCard label={t("expected")} value={initial.ok ? expectedGuests : "—"} detail={t("expectedDetail", { count: activeToday.length })} icon={<UsersRound size={15} />} tone="sage" />
      <MetricCard label={c("pending")} value={initial.ok ? pending : "—"} detail={t("pendingDetail")} icon={<Clock3 size={15} />} tone="gold" />
      <MetricCard label={c("cancelled")} value={initial.ok ? todayBookings.filter((r) => r.status === "cancelled").length : "—"} detail={t("liveDataLabel")} icon={<CalendarDays size={15} />} tone="stone" />
    </section>

    <section className="overview-grid">
      <article className="panel overview-table">
        <PanelHeading title={t("todayList")} detail={t("todayDetail", { count: todayBookings.length })} action={<SectionLink href="/dashboard/reservations">{t("allBookings")}</SectionLink>} />
        {initial.ok && todayBookings.length ? <div className="table-wrap"><table className="data-table">
          <thead><tr><th>{t("tableTime")}</th><th>{t("tableGuest")}</th><th>{t("tablePeople")}</th><th>{t("tableStatus")}</th><th className="hide-mobile">{t("tableReference")}</th><th className="hide-mobile">{t("tableSource")}</th></tr></thead>
          <tbody>{todayBookings.slice(0, 8).map((reservation) => <tr key={reservation.id}>
            <td className="time-cell">{reservation.time}</td><td><span className="guest-primary">{reservation.guest}</span>{reservation.note ? <span className="guest-secondary">{reservation.note}</span> : null}</td>
            <td>{new Intl.NumberFormat(locale).format(reservation.guests)} <span style={{ color: "#aaa194" }}>{c("personShort")}</span></td>
            <td><span className={`status-pill ${statusClass[reservation.status]}`}>{statusLabel(reservation.status)}</span></td><td className="source-tag hide-mobile">{reservation.reference}</td><td className="hide-mobile">{reservation.source === "website" ? c("online") : reservation.source === "phone" ? c("telephone") : c("walkIn")}</td>
          </tr>)}</tbody>
        </table></div> : initial.ok ? <p className="live-empty-state">{t("noTodayReservations")}</p> : null}
        <div className="mobile-table-link"><SectionLink href="/dashboard/reservations">{t("openAll")}</SectionLink></div>
      </article>

      <aside className="panel">
        <PanelHeading title={t("upcoming")} detail={t("upcomingDetail")} action={<Clock3 size={15} color="#9a8c7b" />} />
        {!initial.ok ? <p className="live-empty-state">{errorText}</p> : upcoming.length ? <div className="upcoming-list">{upcoming.map((reservation, index) => <div key={reservation.id}>
          {index === 0 || reservation.date !== upcoming[index - 1]?.date ? <p className="upcoming-day">{dateLabel(reservation.date)}</p> : null}
          <div className="upcoming-item"><span className="upcoming-time">{reservation.time}</span><div><div className="upcoming-name">{reservation.guest}</div><div className="upcoming-meta">{reservation.reference}</div></div><span className="upcoming-count">{reservation.guests} {c("personShort")}</span></div>
        </div>)}</div> : <p className="live-empty-state">{t("noUpcomingReservations")}</p>}
        <div className="upcoming-footer"><Link href="/dashboard/reservations">{t("openToday")} <ArrowUpRight size={13} /></Link></div>
      </aside>
    </section>
  </>;
}
