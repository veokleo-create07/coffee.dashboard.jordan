"use client";

import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Search, UsersRound } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { MetricCard, PageIntro } from "@/components/dashboard/primitives";
import { Modal } from "@/components/dashboard/dialog";
import { loadReservations, type LiveReservation, type ReservationLoadResult } from "@/app/dashboard/actions";

type Range = "day" | "week" | "month";
type StatusFilter = "all" | LiveReservation["status"];
const statusClass: Record<LiveReservation["status"], string> = { pending: "status-arrived", confirmed: "status-confirmed", cancelled: "status-cancelled", completed: "status-completed" };
const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const startOfWeek = (date: Date) => { const value = new Date(date); value.setDate(value.getDate() - ((value.getDay() + 6) % 7)); return value; };
const endOfWeek = (date: Date) => { const value = startOfWeek(date); value.setDate(value.getDate() + 6); return value; };
const monthBounds = (date: Date) => ({ start: new Date(date.getFullYear(), date.getMonth(), 1), end: new Date(date.getFullYear(), date.getMonth() + 1, 0) });

export function ReservationsLive({ today, initialStart, initialEnd, initial }: { today: string; initialStart: string; initialEnd: string; initial: ReservationLoadResult }) {
  const t = useTranslations("Reservations");
  const c = useTranslations("Common");
  const locale = useLocale();
  const [date, setDate] = useState(new Date(`${today}T12:00:00`));
  const [range, setRange] = useState<Range>("day");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [reservations, setReservations] = useState(initial.ok ? initial.reservations : []);
  const [result, setResult] = useState(initial);
  const [loadedRange, setLoadedRange] = useState({ start: initialStart, end: initialEnd });
  const [details, setDetails] = useState<LiveReservation | null>(null);
  const bounds = range === "day" ? { start: date, end: date } : range === "week" ? { start: startOfWeek(date), end: endOfWeek(date) } : monthBounds(date);
  const start = key(bounds.start);
  const end = key(bounds.end);

  useEffect(() => {
    if (start >= loadedRange.start && end <= loadedRange.end) return;
    let active = true;
    void loadReservations(start, end).then((next) => {
      if (!active) return;
      setResult(next);
      if (next.ok) {
        setReservations(next.reservations);
        setLoadedRange({ start, end });
      }
    });
    return () => { active = false; };
  }, [end, loadedRange.end, loadedRange.start, start]);

  const periodReservations = reservations.filter((reservation) => reservation.date >= start && reservation.date <= end);
  const shown = periodReservations.filter((reservation) => {
    if (status !== "all" && reservation.status !== status) return false;
    const term = query.trim().toLocaleLowerCase(locale);
    if (term && !`${reservation.guest} ${reservation.email} ${reservation.reference}`.toLocaleLowerCase(locale).includes(term)) return false;
    return true;
  });
  const loading = (start < loadedRange.start || end > loadedRange.end) && result.ok;
  const expectedGuests = periodReservations.filter((reservation) => reservation.status === "pending" || reservation.status === "confirmed").reduce((sum, reservation) => sum + reservation.guests, 0);
  const format = (dateValue: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...options, timeZone: "Europe/Berlin" }).format(dateValue);
  const title = range === "day" ? format(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : range === "week" ? `${format(bounds.start, { day: "numeric", month: "short" })} – ${format(bounds.end, { day: "numeric", month: "short", year: "numeric" })}` : format(date, { month: "long", year: "numeric" });
  const statusName = (value: LiveReservation["status"]) => c(value);
  const errorText = !result.ok ? result.reason === "unauthorized" ? c("reservationUnauthorized") : result.reason === "permission" ? c("reservationPermission") : c("reservationLoadError") : "";

  function step(direction: -1 | 1) {
    setDate((current) => {
      const next = new Date(current);
      if (range === "month") next.setMonth(next.getMonth() + direction);
      else next.setDate(next.getDate() + direction * (range === "week" ? 7 : 1));
      return next;
    });
  }

  return <>
    <PageIntro eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
    <section className="metric-grid reservations-metrics" aria-label={t("periodLabel")}>
      <MetricCard label={t("count")} value={result.ok ? periodReservations.length : "—"} detail={title} icon={<CalendarDays size={15} />} />
      <MetricCard label={t("expectedGuests")} value={result.ok ? expectedGuests : "—"} detail={t("activeBookingsOnly")} icon={<UsersRound size={15} />} tone="sage" />
      <MetricCard label={c("pending")} value={result.ok ? periodReservations.filter((item) => item.status === "pending").length : "—"} detail={t("liveDataLabel")} icon={<Clock3 size={15} />} tone="gold" />
      <MetricCard label={c("cancelled")} value={result.ok ? periodReservations.filter((item) => item.status === "cancelled").length : "—"} detail={t("liveDataLabel")} icon={<CalendarDays size={15} />} tone="stone" />
    </section>

    <div className="reservation-toolbar">
      <div className="toolbar-upper">
        <div className="range-switcher" aria-label={t("periodLabel")}>{(["day", "week", "month"] as const).map((item) => <button type="button" key={item} className={`range-button${range === item ? " is-active" : ""}`} onClick={() => setRange(item)}>{t(item)}</button>)}</div>
        <div className="date-controls"><button className="icon-button" aria-label={t("previous")} onClick={() => step(-1)}><ChevronLeft size={15} /></button><span className="range-date">{title}</span><button className="icon-button" aria-label={t("next")} onClick={() => step(1)}><ChevronRight size={15} /></button><button className="button-quiet today-button" onClick={() => setDate(new Date(`${today}T12:00:00`))}>{c("today")}</button></div>
      </div>
      <div className="toolbar-lower"><label className="search-field"><Search size={14} /><input aria-label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
        <select className="select-control" aria-label={t("filter")} value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
          <option value="all">{c("all")}</option><option value="pending">{c("pending")}</option><option value="confirmed">{c("confirmed")}</option><option value="completed">{c("completed")}</option><option value="cancelled">{c("cancelled")}</option>
        </select>
      </div>
    </div>
    <div className="reservations-summary"><span className="result-count">{t("resultCount", { count: shown.length })}</span><span className="result-count">{t("liveDataLabel")}</span></div>

    {!result.ok ? <div className="live-data-alert" role="alert">{errorText}</div> : null}
    {loading ? <div className="live-empty-state" role="status">{t("loading")}</div> : null}
    {result.ok && !loading && !shown.length ? <div className="empty-search">{query || status !== "all" ? t("noResults") : t("noReservations")}</div> : null}
    {result.ok && shown.length ? <>
      <div className="reservations-table table-wrap"><table className="data-table management-table"><thead><tr><th>{t("tableTime")}</th><th>{t("tableGuest")}</th><th>{t("tablePeople")}</th><th>{t("tableReference")}</th><th>{t("tableStatus")}</th><th>{t("tableRequests")}</th></tr></thead><tbody>
        {shown.map((reservation) => <tr key={reservation.id}>
          <td className="time-cell">{reservation.time}</td><td><button className="table-name-button" onClick={() => setDetails(reservation)}><span className="guest-primary">{reservation.guest}</span><span className="guest-secondary">{reservation.email}</span></button></td><td>{reservation.guests}</td><td className="source-tag">{reservation.reference}</td><td><span className={`status-pill ${statusClass[reservation.status]}`}>{statusName(reservation.status)}</span></td><td>{reservation.note || <span className="detail-muted">{c("noRequests")}</span>}</td>
        </tr>)}
      </tbody></table></div>
      <div className="booking-card-list">{shown.map((reservation) => <article className="reservation-card" key={reservation.id}>
        <div className="reservation-card-top"><span className="reservation-card-time">{reservation.date === today ? reservation.time : `${format(new Date(`${reservation.date}T12:00:00Z`), { day: "numeric", month: "short" })} · ${reservation.time}`}</span><span className={`status-pill ${statusClass[reservation.status]}`}>{statusName(reservation.status)}</span></div>
        <button className="table-name-button card-name" onClick={() => setDetails(reservation)}><span className="guest-primary">{reservation.guest}</span><span className="guest-secondary">{reservation.email}</span></button>
        <div className="reservation-card-bottom"><span className="reservation-card-meta"><UsersRound size={12} /> {reservation.guests} {c("personShort")} <span>·</span> {reservation.reference}</span><button className="button-quiet" onClick={() => setDetails(reservation)}>{t("details")}</button></div>
      </article>)}</div>
    </> : null}

    <Modal open={Boolean(details)} title={t("detailTitle")} subtitle={details?.reference} onClose={() => setDetails(null)} footer={<button className="button-secondary" onClick={() => setDetails(null)}>{c("close")}</button>}>
      {details ? <div className="detail-stack"><div className="detail-name"><div><strong>{details.guest}</strong><span>{details.guests} {details.guests === 1 ? t("detailPeopleOne") : t("detailPeopleMany")}</span></div></div><div className="detail-line"><CalendarDays size={15} />{format(new Date(`${details.date}T12:00:00Z`), { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {details.time}</div><div className="detail-line">{details.email}</div><div className="detail-line"><span className={`status-pill ${statusClass[details.status]}`}>{statusName(details.status)}</span></div><div className="detail-line"><strong>{t("tableRequests")}</strong></div>{details.note ? <div className="profile-note">{details.note}</div> : <div className="detail-muted">{c("noRequests")}</div>}</div> : null}
    </Modal>
  </>;
}
