"use client";

import { useCallback, useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Coffee, Eye, Pencil, Phone, Plus, Search, UserRound, UsersRound, X } from "lucide-react";
import { MetricCard, PageIntro } from "@/components/dashboard/primitives";
import { Modal, ReservationForm, Toast, type ReservationInput } from "@/components/dashboard/dialog";
import { mockReservations, type Reservation, type ReservationStatus } from "@/lib/dashboard/mock-data";
import { useLocale, useTranslations } from "next-intl";
import { sampleContentKey } from "@/lib/dashboard/sample-content";

type Range = "Tag" | "Woche" | "Monat";
type Filter = "Alle" | "Bestätigt" | "Eingetroffen" | "Am Tisch" | "Storniert";
const filterMap: Record<Filter, ReservationStatus | "all"> = { Alle: "all", Bestätigt: "confirmed", Eingetroffen: "arrived", "Am Tisch": "seated", Storniert: "cancelled" };
const statusClass: Record<ReservationStatus, string> = { confirmed: "status-confirmed", arrived: "status-arrived", seated: "status-seated", completed: "status-completed", cancelled: "status-cancelled", "no-show": "status-no-show" };

function dateKey(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function formatDate(date: Date, options: Intl.DateTimeFormatOptions, locale: string) { return new Intl.DateTimeFormat(locale, options).format(date); }
function addCalendarMonths(date: Date, amount: number) {
  const next = new Date(date.getFullYear(), date.getMonth() + amount, 1);
  const lastDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
  next.setDate(Math.min(date.getDate(), lastDay));
  return next;
}
function rangeBounds(date: Date, range: Range) {
  if (range === "Tag") return { start: date, end: date };
  if (range === "Woche") {
    const start = new Date(date);
    start.setDate(date.getDate() - ((date.getDay() + 6) % 7));
    const end = new Date(start); end.setDate(start.getDate() + 6);
    return { start, end };
  }
  return { start: new Date(date.getFullYear(), date.getMonth(), 1), end: new Date(date.getFullYear(), date.getMonth() + 1, 0) };
}
function periodTitle(date: Date, range: Range, locale: string) {
  if (range === "Tag") return formatDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }, locale);
  if (range === "Woche") {
    const { start, end } = rangeBounds(date, range);
    return `${formatDate(start, { day: "numeric" }, locale)} – ${formatDate(end, { day: "numeric", month: "short", year: "numeric" }, locale)}`;
  }
  return formatDate(date, { month: "long", year: "numeric" }, locale);
}
function initials(name: string) { return name.split(/[ &]/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

export default function ReservationsPage() {
  const t = useTranslations("Reservations");
  const c = useTranslations("Common");
  const sample = useTranslations("SampleContent");
  const locale = useLocale();
  const statusName = (status: ReservationStatus) => c(({confirmed:"confirmed",arrived:"arrived",seated:"seated",completed:"completed",cancelled:"cancelled","no-show":"noShow"})[status]);
  const sourceName = (value: string) => value === "Telefon" ? c("telephone") : value === "Walk-in" ? c("walkIn") : c("online");
  const noteText = (value: string) => { const key = sampleContentKey(value); return key ? sample(key) : value; };
  const rangeName = (value: Range) => t(value === "Tag" ? "day" : value === "Woche" ? "week" : "month");
  const filterName = (value: Filter) => value === "Alle" ? c("all") : value === "Bestätigt" ? c("confirmed") : value === "Eingetroffen" ? c("arrived") : value === "Am Tisch" ? c("seated") : c("cancelled");
  const periodLabel = (value: Date, period: Range) => periodTitle(value, period, locale);
  const [reservations, setReservations] = useState(mockReservations);
  const [range, setRange] = useState<Range>("Tag");
  const [date, setDate] = useState(new Date(2026, 9, 24));
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("Alle");
  const [source, setSource] = useState("Alle Quellen");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);
  const [rescheduling, setRescheduling] = useState<Reservation | null>(null);
  const [details, setDetails] = useState<Reservation | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [toast, setToast] = useState("");
  const dismissToast = useCallback(() => setToast(""), []);

  const shown = useMemo(() => {
    const bounds = rangeBounds(date, range);
    return reservations.filter((reservation) => {
      const key = reservation.date;
      const inRange = key >= dateKey(bounds.start) && key <= dateKey(bounds.end);
      const matchesQuery = `${reservation.guest} ${reservation.email} ${reservation.phone} ${reservation.id}`.toLowerCase().includes(query.toLowerCase().trim());
      const status = filterMap[filter];
      const matchesStatus = status === "all" || reservation.status === status;
      const matchesSource = source === "Alle Quellen" || reservation.source === source;
      return inRange && matchesQuery && matchesStatus && matchesSource;
    }).sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  }, [date, filter, query, range, reservations, source]);

  function changeRange(next: Range) { setRange(next); }
  function stepDate(direction: -1 | 1) {
    setDate((current) => {
      const next = new Date(current);
      if (range === "Monat") return addCalendarMonths(next, direction);
      next.setDate(next.getDate() + direction * (range === "Woche" ? 7 : 1));
      return next;
    });
  }
  function createReservation(values: ReservationInput) {
    const next: Reservation = { ...values, id: `AL-${Date.now().toString().slice(-6)}`, status: "confirmed" };
    setReservations((items) => [...items, next]); setShowNew(false); setToast(c("mockAdded"));
  }
  function updateReservation(original: Reservation, values: ReservationInput, message: string) {
    setReservations((items) => items.map((item) => item.id === original.id ? { ...item, ...values } : item));
    setEditing(null); setRescheduling(null); setToast(message);
  }
  function updateStatus(reservation: Reservation, status: ReservationStatus, message: string) {
    setReservations((items) => items.map((item) => item.id === reservation.id ? { ...item, status } : item));
    setToast(message);
  }
  function actionFor(reservation: Reservation) {
    if (reservation.status === "confirmed") return <button className="row-action action-arrive" onClick={() => updateStatus(reservation, "arrived", t("localArrived"))}><UserRound size={12} />{t("actionArrive")}</button>;
    if (reservation.status === "arrived") return <button className="row-action action-arrive" onClick={() => updateStatus(reservation, "seated", t("localSeated"))}><UsersRound size={12} />{t("actionSeat")}</button>;
    if (reservation.status === "seated") return <button className="row-action action-free" onClick={() => updateStatus(reservation, "completed", t("localFree"))}><X size={12} />{t("actionFree")}</button>;
    return null;
  }

  const bounds = rangeBounds(date, range);
  const activeBookings = shown.filter((reservation) => reservation.status !== "cancelled");
  const expectedGuests = activeBookings.reduce((sum, reservation) => sum + reservation.guests, 0);
  const seatedGuests = activeBookings.filter((reservation) => reservation.status === "seated").reduce((sum, reservation) => sum + reservation.guests, 0);
  const noShows = shown.filter((reservation) => reservation.status === "no-show").length;
  return <>
    <PageIntro eyebrow={t("eyebrow")} title={t("title")} description={t("description")} action={<button className="button-primary" onClick={() => setShowNew(true)}><Plus size={15} /><span>{c("newReservation")}</span></button>} />

    <section className="metric-grid reservations-metrics" aria-label={t("periodLabel")}>
      <MetricCard label={t("count")} value={activeBookings.length} detail={periodLabel(date, range)} icon={<CalendarDays size={15} />} />
      <MetricCard label={t("expectedGuests")} value={expectedGuests} detail={t("periodMetric")} icon={<UsersRound size={15} />} tone="sage" />
      <MetricCard label={c("seated")} value={seatedGuests} detail={t("seatedDetail")} icon={<Coffee size={15} />} tone="gold" />
      <MetricCard label={t("noShows")} value={noShows} detail={t("periodNoShow")} icon={<Clock3 size={15} />} tone="stone" />
    </section>

    <div className="reservation-toolbar">
      <div className="toolbar-upper">
        <div className="range-switcher" aria-label={t("periodLabel")}>{(["Tag", "Woche", "Monat"] as const).map((item) => <button type="button" key={item} className={`range-button${range === item ? " is-active" : ""}`} onClick={() => changeRange(item)}>{rangeName(item)}</button>)}</div>
        <div className="date-controls"><button className="icon-button" aria-label={t("previous")} onClick={() => stepDate(-1)}><ChevronLeft size={15} /></button><span className="range-date">{periodLabel(date, range)}</span><button className="icon-button" aria-label={t("next")} onClick={() => stepDate(1)}><ChevronRight size={15} /></button><button className="button-quiet today-button" onClick={() => setDate(new Date(2026, 9, 24))}>{c("today")}</button></div>
      </div>
      <div className="toolbar-lower"><label className="search-field"><Search size={14} /><input aria-label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={query} onChange={(event) => setQuery(event.target.value)} /></label><select className="select-control" aria-label={t("sourceFilter")} value={source} onChange={(event) => setSource(event.target.value)}><option value="Alle Quellen">{c("sourceAll")}</option><option>{c("online")}</option><option value="Telefon">{c("telephone")}</option><option value="Walk-in">{c("walkIn")}</option></select></div>
    </div>

    <div className="reservations-summary"><div className="filter-switcher" aria-label={t("filter")}>{(Object.keys(filterMap) as Filter[]).map((item) => <button type="button" className={`filter-button${filter === item ? " is-active" : ""}`} onClick={() => setFilter(item)} key={item}>{filterName(item)}</button>)}</div><span className="result-count">{shown.length} {shown.length === 1 ? t("resultsOne") : t("resultsMany")} · {t("mockData")}</span></div>
    <div className="reservations-list-heading"><strong><CalendarDays size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />{range === "Tag" ? formatDate(date, { weekday: "long", day: "numeric", month: "long" }, locale) : range === "Woche" ? t("weekFrom", {date: formatDate(bounds.start, { day: "numeric", month: "short" }, locale)}) : formatDate(date, { month: "long", year: "numeric" }, locale)}</strong><span className="result-count">{shown.reduce((sum, r) => sum + r.guests, 0)} {t("expectedGuests")}</span></div>

    <div className="reservations-table table-wrap"><table className="data-table management-table"><thead><tr><th>{t("tableTime")}</th><th>{t("tableGuest")}</th><th>{t("tablePeople")}</th><th>{t("tableSource")}</th><th>{t("tableStatus")}</th><th>{t("tableActions")}</th></tr></thead><tbody>
      {shown.map((reservation) => <tr key={reservation.id}>
        <td className="time-cell">{reservation.time}</td>
        <td><button className="table-name-button" onClick={() => setDetails(reservation)}><span className="guest-primary">{reservation.guest}</span><span className="guest-secondary">{reservation.id}</span></button></td>
        <td>{reservation.guests}</td><td><span className="source-tag">{sourceName(reservation.source)}</span></td>
        <td><span className={`status-pill ${statusClass[reservation.status]}`}>{statusName(reservation.status)}</span></td>
        <td><div className="row-actions">{actionFor(reservation)}<button className="icon-button row-icon" aria-label={t("editAction", {guest: reservation.guest})} title={t("edit")} onClick={() => setEditing(reservation)}><Pencil size={13} /></button><button className="icon-button row-icon" aria-label={t("rescheduleAction", {guest: reservation.guest})} title={t("reschedule")} onClick={() => setRescheduling(reservation)}><Clock3 size={13} /></button><button className="icon-button row-icon" aria-label={t("detailsAction", {guest: reservation.guest})} title={t("details")} onClick={() => setDetails(reservation)}><Eye size={13} /></button><button className="icon-button row-icon cancel-icon" aria-label={t("cancelAction", {guest: reservation.guest})} title={c("cancel")} onClick={() => setCancelTarget(reservation)}><X size={13} /></button></div></td>
      </tr>)}
    </tbody></table></div>

    <div className="booking-card-list">{shown.length ? shown.map((reservation) => <article className="reservation-card" key={reservation.id}>
      <div className="reservation-card-top"><span className="reservation-card-time">{range === "Tag" ? reservation.time : `${formatDate(new Date(`${reservation.date}T12:00:00`), { weekday: "short", day: "numeric", month: "short" }, locale)} · ${reservation.time}`}</span><span className={`status-pill ${statusClass[reservation.status]}`}>{statusName(reservation.status)}</span></div>
      <button className="table-name-button card-name" onClick={() => setDetails(reservation)}><span className="guest-primary">{reservation.guest}</span><span className="guest-secondary">{reservation.id}</span></button>
      <div className="reservation-card-bottom"><span className="reservation-card-meta"><UsersRound size={12} /> {reservation.guests} {c("personShort")} <span>·</span> {sourceName(reservation.source)}</span><div className="row-actions">{actionFor(reservation)}<button className="icon-button row-icon" aria-label={t("editAction", {guest: reservation.guest})} onClick={() => setEditing(reservation)}><Pencil size={13} /></button><button className="icon-button row-icon" aria-label={t("rescheduleAction", {guest: reservation.guest})} onClick={() => setRescheduling(reservation)}><Clock3 size={13} /></button><button className="icon-button row-icon cancel-icon" aria-label={t("cancelAction", {guest: reservation.guest})} onClick={() => setCancelTarget(reservation)}><X size={13} /></button></div></div>
    </article>) : <div className="empty-search">{t("noResults")}</div>}</div>
    {!shown.length ? <div className="empty-search desktop-empty">{t("noResults")}</div> : null}
    <div className="reservations-footnote"><span><Phone size={12} /> {t("sourceNote")}</span><span>{t("notSaved")}</span></div>

    <Modal open={showNew} title={c("newReservation")} subtitle={t("newSubtitle")} onClose={() => setShowNew(false)}><ReservationForm onSubmit={createReservation} onCancel={() => setShowNew(false)} submitLabel={t("addMock")} /></Modal>
    <Modal open={Boolean(editing)} title={t("editTitle")} subtitle={editing?.id} onClose={() => setEditing(null)}>{editing ? <ReservationForm initial={editing} onSubmit={(values) => updateReservation(editing, values, t("localUpdate"))} onCancel={() => setEditing(null)} submitLabel={t("saveChanges")} /> : null}</Modal>
    <Modal open={Boolean(rescheduling)} title={t("rescheduleTitle")} subtitle={t("dateAdjust")} onClose={() => setRescheduling(null)}>{rescheduling ? <ReservationForm initial={rescheduling} onSubmit={(values) => updateReservation(rescheduling, values, t("localReschedule"))} onCancel={() => setRescheduling(null)} submitLabel={t("saveReschedule")} includeSource={false} /> : null}</Modal>
    <Modal open={Boolean(details)} title={t("detailTitle")} subtitle={details?.id} onClose={() => setDetails(null)} footer={<button className="button-secondary" onClick={() => setDetails(null)}>{c("close")}</button>}>
      {details ? <div className="detail-stack"><div className="detail-name"><span className="avatar avatar-large">{initials(details.guest)}</span><div><strong>{details.guest}</strong><span>{details.guests} {details.guests === 1 ? t("detailPeopleOne") : t("detailPeopleMany")}</span></div></div><div className="detail-line"><CalendarDays size={15} />{formatDate(new Date(`${details.date}T12:00:00`), { weekday: "long", day: "numeric", month: "long", year: "numeric" }, locale)} · {details.time}{c("hours") ? ` ${c("hours")}` : ""}</div><div className="detail-line"><Phone size={15} />{details.phone}</div><div className="detail-line">{details.email || c("noEmail")}</div><div className="detail-line"><span className={`status-pill ${statusClass[details.status]}`}>{statusName(details.status)}</span><span className="source-tag">{t("sourcePrefix")} {sourceName(details.source)}</span></div>{details.note ? <div className="profile-note">{noteText(details.note)}</div> : <div className="detail-muted">{c("noRequests")}</div>}<p className="detail-disclaimer">{c("sampleDisclaimer")}</p></div> : null}
    </Modal>
    <Modal open={Boolean(cancelTarget)} title={t("cancelBooking")} subtitle={cancelTarget?.guest} onClose={() => setCancelTarget(null)} footer={<><button className="button-secondary" onClick={() => setCancelTarget(null)}>{t("cancelNevermind")}</button><button className="button-danger" onClick={() => { if (cancelTarget) updateStatus(cancelTarget, "cancelled", t("localCancelled")); setCancelTarget(null); }}>{t("cancelLocal")}</button></>}>
      <p className="cancel-copy">{t("cancelCopy")}</p>
    </Modal>
    <Toast message={toast} onDismiss={dismissToast} />
  </>;
}
