"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Ban, CalendarDays, Check, ChevronLeft, ChevronRight, CircleCheck, Clock3, LoaderCircle, Mail, MapPin, Monitor, MoreHorizontal, Pencil, Phone, Plus, Search, Trash2, UserRoundCheck, UsersRound, UserX, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { MetricCard, PageIntro } from "@/components/dashboard/primitives";
import { Modal, Toast } from "@/components/dashboard/dialog";
import { useReservationRealtime } from "@/lib/dashboard/use-reservation-realtime";
import { loadReservations, manageReservation, type BookingSource, type LiveReservation, type ReservationActionResult, type ReservationLoadResult, type ReservationStatus } from "@/app/dashboard/actions";

type StatusFilter = "all" | LiveReservation["status"];
type Range = "day" | "week" | "month";
const statusClass: Record<ReservationStatus, string> = { pending: "status-pending", confirmed: "status-confirmed", arrived: "status-arrived", completed: "status-completed", cancelled: "status-cancelled", no_show: "status-no-show" };
const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const activeStatuses = new Set<ReservationStatus>(["pending", "confirmed", "arrived"]);
const errorKeys: Record<string, string> = { INVALID_INPUT: "invalidInput", CAPACITY_CONFIG: "capacityConfig", PAST: "past", BOOKING_WINDOW: "bookingWindow", GUEST_LIMIT: "guestLimit", CLOSED: "closed", OUTSIDE_HOURS: "outsideHours", INVALID_SLOT: "invalidSlot", RESERVATION_FULL: "full", ABSOLUTE_CAPACITY: "absoluteCapacity", RULE_EXCEPTION_REQUIRED: "exceptionRequired", RULE_EXCEPTION_FORBIDDEN: "exceptionForbidden", NOT_FOUND: "notFound", INVALID_TRANSITION: "invalidTransition", NO_SHOW_TOO_EARLY: "noShowTooEarly", NOT_STAFF: "notStaff", UNAVAILABLE: "unavailable", VISIT_STILL_ACTIVE: "visitStillActive", OCCUPANCY_TIMESTAMP_FORBIDDEN: "occupancyTimestampForbidden" };
const lateThresholdMs = 15 * 60_000;
const visitDurationMs = 90 * 60_000;
const hiddenReservationStorageKey = "altstadtliebe:hidden-reservation-ids";
const visitTagStorageKey = "altstadtliebe:visit-tags";
type VisitTagId = "window" | "counter" | "back" | "entrance" | "stroller" | "birthday";
const visitTagIds: VisitTagId[] = ["window", "counter", "back", "entrance", "stroller", "birthday"];
const startOfWeek = (date: Date) => { const value = new Date(date); value.setDate(value.getDate() - ((value.getDay() + 6) % 7)); return value; };
const endOfWeek = (date: Date) => { const value = startOfWeek(date); value.setDate(value.getDate() + 6); return value; };
const monthBounds = (date: Date) => ({ start: new Date(date.getFullYear(), date.getMonth(), 1), end: new Date(date.getFullYear(), date.getMonth() + 1, 0) });
function isLate(reservation: LiveReservation, now: number) {
  const scheduled = Date.parse(reservation.startsAt);
  if (reservation.arrivedAt) return Date.parse(reservation.arrivedAt) > scheduled + lateThresholdMs;
  return (reservation.status === "pending" || reservation.status === "confirmed") && now > scheduled + lateThresholdMs;
}
function timerValue(milliseconds: number) {
  const seconds = Math.floor(Math.abs(milliseconds) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function VisitTimer({ reservation, now }: { reservation: LiveReservation; now: number }) {
  const t = useTranslations("Reservations");
  if (reservation.status !== "arrived") return null;
  if (!reservation.arrivedAt) return <span className="visit-timer timer-unavailable">{t("arrivalTimeUnavailable")}</span>;
  const remaining = Date.parse(reservation.arrivedAt) + visitDurationMs - now;
  return <span className={`visit-timer${remaining < 0 ? " is-overdue" : ""}`}>
    <Clock3 size={12} />
    {remaining < 0 ? t("visitTimerOverdue", { time: timerValue(remaining) }) : t("visitTimerRemaining", { time: timerValue(remaining) })}
  </span>;
}

function WeekSummary({ start, selected, reservations, locale, onSelect }: { start: Date; selected: string; reservations: LiveReservation[]; locale: string; onSelect: (date: string) => void }) {
  const c = useTranslations("Common");
  return <section className="week-summary" aria-label={c("bookings")}>{Array.from({ length: 7 }, (_, index) => { const day = new Date(start); day.setDate(start.getDate() + index); const dayKey = key(day); const count = reservations.filter((item) => item.date === dayKey).length; return <button type="button" className={`week-day-card${dayKey === selected ? " is-selected" : ""}`} key={dayKey} onClick={() => onSelect(dayKey)}><span className="week-day-label">{new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", timeZone: "Europe/Berlin" }).format(day)}</span><strong>{count}</strong><span className="week-mini-bars" aria-hidden="true">{[.45, .72, 1, .68].map((height, bar) => <i key={bar} style={{ height: `${Math.max(7, Math.round((count + 5) * height))}px` }} />)}</span><span className="week-day-caption">{c("bookings")}</span></button>; })}</section>;
}

function MonthCalendar({ month, selected, reservations, locale, onSelect }: { month: Date; selected: string; reservations: LiveReservation[]; locale: string; onSelect: (date: string) => void }) {
  const first = new Date(month.getFullYear(), month.getMonth(), 1); const offset = (first.getDay() + 6) % 7; const gridStart = new Date(first); gridStart.setDate(first.getDate() - offset); const days = Array.from({ length: 42 }, (_, index) => { const value = new Date(gridStart); value.setDate(gridStart.getDate() + index); return value; }); const weekdays = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(2026, 9, 19 + index)));
  return <section className="month-calendar" aria-label={new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(month)}><div className="month-weekdays">{weekdays.map((weekday) => <span key={weekday}>{weekday}</span>)}</div><div className="month-grid">{days.map((day) => { const dayKey = key(day); const items = reservations.filter((item) => item.date === dayKey); const outside = day.getMonth() !== month.getMonth(); const sources = Array.from(new Set(items.map((item) => item.source))).slice(0, 2); return <button type="button" className={`month-day${outside ? " is-outside" : ""}${dayKey === selected ? " is-selected" : ""}`} key={dayKey} onClick={() => onSelect(dayKey)}><strong>{day.getDate()}</strong><span className="month-source-dots" aria-hidden="true">{sources.map((source) => <i className={`source-${source}`} key={source} />)}</span>{!outside && items.length ? <span>{items.length}</span> : null}</button>; })}</div></section>;
}

export function ReservationsLive({ today, initialStart, initialEnd, initial, initialDate, initialReservationId }: { today: string; initialStart: string; initialEnd: string; initial: ReservationLoadResult; initialDate?: string; initialReservationId?: string }) {
  const t = useTranslations("Reservations"); const c = useTranslations("Common"); const locale = useLocale();
  const [date, setDate] = useState(new Date(`${initialDate ?? today}T12:00:00`)); const [range, setRange] = useState<Range>("day"); const [status, setStatus] = useState<StatusFilter>("all"); const [query, setQuery] = useState("");
  const [reservations, setReservations] = useState(initial.ok ? initial.reservations.filter((item) => item.status !== "cancelled") : []); const [result, setResult] = useState(initial); const [loadedRange, setLoadedRange] = useState({ start: initialStart, end: initialEnd }); const [hiddenReservationIds, setHiddenReservationIds] = useState<Set<string>>(() => { if (typeof window === "undefined") return new Set(); try { const saved = JSON.parse(window.localStorage.getItem(hiddenReservationStorageKey) ?? "[]"); return new Set(Array.isArray(saved) ? saved.filter((value): value is string => typeof value === "string") : []); } catch { return new Set(); } });
  const [details, setDetails] = useState<LiveReservation | null>(() => initial.ok && initialReservationId ? initial.reservations.find((item) => item.id === initialReservationId && item.status !== "cancelled") ?? null : null); const [editing, setEditing] = useState(false); const [creating, setCreating] = useState(false); const [confirmCancel, setConfirmCancel] = useState(false); const [confirmDelete, setConfirmDelete] = useState(false); const [confirmBulkDelete, setConfirmBulkDelete] = useState(false); const [arriveTarget, setArriveTarget] = useState<LiveReservation | null>(null); const [arriveTag, setArriveTag] = useState<VisitTagId | "">(""); const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set()); const [bulkDeleting, setBulkDeleting] = useState(false);
  const [pending, startTransition] = useTransition(); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [now, setNow] = useState(() => Date.now());
  const [visitTags, setVisitTags] = useState<Record<string, VisitTagId>>(() => { if (typeof window === "undefined") return {}; try { const saved = JSON.parse(window.localStorage.getItem(visitTagStorageKey) ?? "{}"); return saved && typeof saved === "object" ? Object.fromEntries(Object.entries(saved).filter(([id, tag]) => typeof id === "string" && visitTagIds.includes(tag as VisitTagId))) as Record<string, VisitTagId> : {}; } catch { return {}; } });
  const bounds = range === "day" ? { start: date, end: date } : range === "week" ? { start: startOfWeek(date), end: endOfWeek(date) } : monthBounds(date);
  const start = key(bounds.start); const end = key(bounds.end); const selectedKey = key(date);

  const refreshRef = useRef<() => void>(() => undefined);
  const refreshLive = () => { refreshRef.current(); };
  useReservationRealtime(refreshLive);

  async function refresh() {
    const next = await loadReservations(start, end); const visible = next.ok ? next.reservations.filter((item) => item.status !== "cancelled" && !hiddenReservationIds.has(item.id)) : [];
    setResult(next.ok ? { ...next, reservations: visible } : next);
    if (next.ok) { setReservations(visible); setLoadedRange({ start, end }); }
    if (details && next.ok) setDetails(visible.find((item) => item.id === details.id) ?? null);
  }
  useEffect(() => {
    refreshRef.current = () => { void refresh(); };
    // The callback intentionally tracks the latest range and selected detail.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [details, end, hiddenReservationIds, start]);
  useEffect(() => {
    if (start >= loadedRange.start && end <= loadedRange.end) return;
    let active = true;
    void loadReservations(start, end).then((next) => { if (!active) return; const visible = next.ok ? next.reservations.filter((item) => item.status !== "cancelled" && !hiddenReservationIds.has(item.id)) : []; setResult(next.ok ? { ...next, reservations: visible } : next); if (next.ok) { setReservations(visible); setLoadedRange({ start, end }); } });
    return () => { active = false; };
  }, [end, hiddenReservationIds, loadedRange.end, loadedRange.start, start]);
  useEffect(() => {
    let active = true;
    let inFlight = false;
    const poll = async () => {
      if (inFlight) return;
      inFlight = true;
      const next = await loadReservations(start, end);
      inFlight = false;
      if (!active) return;
      const visible = next.ok ? next.reservations.filter((item) => item.status !== "cancelled" && !hiddenReservationIds.has(item.id)) : [];
      setResult(next.ok ? { ...next, reservations: visible } : next);
      if (next.ok) {
        setReservations(visible);
        setLoadedRange({ start, end });
        setDetails((current) => current ? visible.find((item) => item.id === current.id) ?? null : null);
      }
    };
    const interval = window.setInterval(() => { void poll(); }, 10_000);
    const onFocus = () => { if (document.visibilityState === "visible") void poll(); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => { active = false; window.clearInterval(interval); window.clearInterval(clock); window.removeEventListener("focus", onFocus); document.removeEventListener("visibilitychange", onFocus); };
  }, [end, hiddenReservationIds, start]);

  const periodReservations = reservations.filter((item) => item.date >= start && item.date <= end);
  const shown = periodReservations.filter((item) => {
    if (status !== "all" && item.status !== status) return false;
    const term = query.trim().toLocaleLowerCase(locale);
    return !term || `${item.guest} ${item.email ?? ""} ${item.phone ?? ""} ${item.reference}`.toLocaleLowerCase(locale).includes(term);
  });
  const loading = (start < loadedRange.start || end > loadedRange.end) && result.ok;
  const expectedGuests = periodReservations.filter((item) => activeStatuses.has(item.status)).reduce((sum, item) => sum + item.guests, 0);
  const occupiedGuests = periodReservations.filter((item) => item.status === "arrived" && !item.departedAt).reduce((sum, item) => sum + item.guests, 0);
  const noShows = periodReservations.filter((item) => item.status === "no_show").length;
  const format = (value: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...options, timeZone: "Europe/Berlin" }).format(value);
  const title = format(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const statusName = (value: ReservationStatus) => c(value === "no_show" ? "noShow" : value);
  const errorText = !result.ok ? result.reason === "unauthorized" ? c("reservationUnauthorized") : result.reason === "permission" ? c("reservationPermission") : c("reservationLoadError") : "";
  const translatedError = (code: string) => t(`errors.${errorKeys[code] ?? "unavailable"}`);
  const timestampLabel = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Berlin" }).format(new Date(value));
  function step(direction: -1 | 1) { setDate((current) => { const next = new Date(current); next.setDate(next.getDate() + direction * (range === "week" ? 7 : range === "month" ? 30 : 1)); return next; }); }
  function submit(values: Parameters<typeof manageReservation>[0], options?: { removeFromView?: boolean; visitTag?: VisitTagId }) {
    setError("");
    const optimisticId = values.action === "create" ? `optimistic-${Date.now()}` : null;
    if (optimisticId && values.date && values.time && values.guest) {
      const optimistic: LiveReservation = {
        id: optimisticId,
        reference: "",
        guest: values.guest.trim(),
        email: values.email?.trim() || null,
        phone: values.phone?.trim() || null,
        date: values.date,
        time: values.time,
        startsAt: `${values.date}T${values.time}:00+01:00`,
        arrivedAt: null,
        departedAt: null,
        guests: values.guests ?? 1,
        status: "confirmed",
        source: values.source ?? "phone",
        note: values.note?.trim() || null,
      };
      setCreating(false);
      setReservations((current) => [...current, optimistic].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
    }
    startTransition(async () => {
      const response: ReservationActionResult = await manageReservation(values);
      if (!response.ok) {
        if (optimisticId) setReservations((current) => current.filter((item) => item.id !== optimisticId));
        setError(translatedError(response.code));
        return;
      }
      setEditing(false); setConfirmCancel(false); setConfirmDelete(false); setArriveTarget(null); setArriveTag(""); setMessage(t(`success.${values.action === "status" ? values.status : values.action}`));
      if (options?.visitTag && response.reservation) setVisitTags((current) => { const next = { ...current, [response.reservation!.id]: options.visitTag! }; window.localStorage.setItem(visitTagStorageKey, JSON.stringify(next)); return next; });
      if (response.reservation && (response.reservation.status === "completed" || response.reservation.status === "cancelled")) setVisitTags((current) => { if (!current[response.reservation!.id]) return current; const next = { ...current }; delete next[response.reservation!.id]; window.localStorage.setItem(visitTagStorageKey, JSON.stringify(next)); return next; });
      if (response.reservation && options?.removeFromView) {
        setHiddenReservationIds((current) => { const next = new Set(current).add(response.reservation!.id); window.localStorage.setItem(hiddenReservationStorageKey, JSON.stringify([...next])); return next; });
        setReservations((current) => current.filter((item) => item.id !== response.reservation!.id));
        setDetails((current) => current?.id === response.reservation!.id ? null : current);
      } else if (response.reservation) {
        if (response.reservation.status === "cancelled") {
          setReservations((current) => current.filter((item) => item.id !== response.reservation?.id));
          setDetails((current) => current?.id === response.reservation?.id ? null : current);
        } else {
          setReservations((current) => current.some((item) => item.id === response.reservation?.id)
            ? current.map((item) => item.id === response.reservation?.id ? response.reservation as LiveReservation : item)
            : optimisticId && current.some((item) => item.id === optimisticId)
              ? current.map((item) => item.id === optimisticId ? response.reservation as LiveReservation : item)
            : [...current, response.reservation as LiveReservation].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
          setDetails((current) => current?.id === response.reservation?.id ? response.reservation as LiveReservation : current);
        }
      }
      window.setTimeout(() => { void refresh(); }, 1200);
    });
  }
  function performStatus(next: NonNullable<Parameters<typeof manageReservation>[0]["status"]>) {
    if (!details) return;
    if (next === "cancelled") { setConfirmCancel(true); return; }
    if (next === "arrived") { setArriveTarget(details); setArriveTag(""); return; }
    submit({ action: "status", id: details.id, status: next });
  }
  function toggleSelected(id: string) {
    setSelectedIds((current) => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  }
  function toggleAllShown() {
    setSelectedIds((current) => {
      const next = new Set(current); const allSelected = shown.length > 0 && shown.every((item) => next.has(item.id));
      shown.forEach((item) => allSelected ? next.delete(item.id) : next.add(item.id)); return next;
    });
  }
  async function deleteSelected() {
    const ids = [...selectedIds].filter((id) => shown.some((item) => item.id === id));
    if (!ids.length) return;
    setBulkDeleting(true); setError("");
    const succeeded: string[] = []; let firstError = "";
    for (const id of ids) {
      const response = await manageReservation({ action: "status", id, status: "cancelled" });
      if (response.ok) succeeded.push(id); else if (!firstError) firstError = translatedError(response.code);
    }
    if (succeeded.length) {
      setHiddenReservationIds((current) => { const next = new Set(current); succeeded.forEach((id) => next.add(id)); window.localStorage.setItem(hiddenReservationStorageKey, JSON.stringify([...next])); return next; });
      setReservations((current) => current.filter((item) => !succeeded.includes(item.id)));
      setDetails((current) => current && succeeded.includes(current.id) ? null : current);
      setSelectedIds((current) => { const next = new Set(current); succeeded.forEach((id) => next.delete(id)); return next; });
      setMessage(t("success.bulkDeleted", { count: succeeded.length }));
    }
    setBulkDeleting(false); setConfirmBulkDelete(false); if (firstError) setError(firstError); void refresh();
  }
  const sourceLabel = (source: BookingSource) => source === "website" ? c("online") : source === "phone" ? c("telephone") : c("walkIn");

  return <>
    <PageIntro eyebrow="" title={t("title")} description={title} action={<div className="reservation-header-actions"><div className="date-controls"><button className="icon-button" aria-label={t("previousDay")} onClick={() => step(-1)}><ChevronLeft size={16} /></button><span className="range-date"><CalendarDays size={16} />{range === "day" ? title : range === "week" ? `${format(bounds.start, { day: "numeric", month: "short" })} – ${format(bounds.end, { day: "numeric", month: "short", year: "numeric" })}` : format(date, { month: "long", year: "numeric" })}</span><button className="icon-button" aria-label={t("nextDay")} onClick={() => step(1)}><ChevronRight size={16} /></button></div><button className="button-quiet today-button" onClick={() => { setDate(new Date(`${today}T12:00:00`)); setRange("day"); }}>{c("today")}</button><button className="button-primary new-booking-button" onClick={() => { setCreating(true); setError(""); }}><Plus size={16} />{c("newReservation")}</button></div>} />
    <section className="metric-grid reservations-metrics" aria-label={t("periodLabel")}>
      <MetricCard label={t("count")} value={result.ok ? periodReservations.length : "—"} detail={t("liveDataLabel")} icon={<CalendarDays size={18} />} />
      <MetricCard label={t("expectedGuests")} value={result.ok ? expectedGuests : "—"} detail={t("activeBookingsOnly")} icon={<UsersRound size={18} />} tone="sage" />
      <MetricCard label={t("currentlySeated")} value={result.ok ? occupiedGuests : "—"} detail={t("liveDataLabel")} icon={<UserRoundCheck size={18} />} tone="sage" />
      <MetricCard label={t("noShows")} value={result.ok ? noShows : "—"} detail={t("periodNoShow")} icon={<UserX size={18} />} tone="stone" />
    </section>

    <div className="reservation-toolbar"><div className="range-switcher" aria-label={c("bookings")}><button type="button" className={range === "day" ? "is-active" : ""} onClick={() => setRange("day")}>{t("day")}</button><button type="button" className={range === "week" ? "is-active" : ""} onClick={() => setRange("week")}>{t("week")}</button><button type="button" className={range === "month" ? "is-active" : ""} onClick={() => setRange("month")}>{t("month")}</button></div><div className="toolbar-lower"><label className="search-field"><Search size={14} /><input aria-label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <select className="select-control" aria-label={t("filter")} value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
        <option value="all">{c("all")}</option>{(["pending", "confirmed", "arrived", "completed", "no_show"] as const).map((item) => <option key={item} value={item}>{statusName(item)}</option>)}
      </select></div></div>
    {range === "week" && result.ok ? <WeekSummary start={bounds.start} selected={selectedKey} reservations={reservations} locale={locale} onSelect={(value) => { setDate(new Date(`${value}T12:00:00`)); setRange("day"); }} /> : null}
    {range === "month" && result.ok ? <MonthCalendar month={date} selected={selectedKey} reservations={reservations} locale={locale} onSelect={(value) => { setDate(new Date(`${value}T12:00:00`)); setRange("day"); }} /> : null}
    <div className={`reservation-workspace${details && !editing ? " has-details" : ""}`}><div className="reservation-list-column"><div className="reservations-summary"><span className="result-count">{t("resultCount", { count: shown.length })}</span><span className="result-count">{t("liveDataLabel")}</span></div>
    {shown.length ? <div className="bulk-selection-bar"><label><input type="checkbox" checked={shown.every((item) => selectedIds.has(item.id))} onChange={toggleAllShown} aria-label={t("selectAll")} />{t("selectAll")}</label>{selectedIds.size ? <><span>{t("selectedCount", { count: selectedIds.size })}</span><button type="button" className="button-danger button-compact" onClick={() => setConfirmBulkDelete(true)}><Trash2 size={14} />{t("deleteSelected")}</button></> : null}</div> : null}
    {!result.ok ? <div className="live-data-alert" role="alert">{errorText}</div> : null}
    {loading ? <div className="live-empty-state" role="status">{t("loading")}</div> : null}
    {result.ok && !loading && !shown.length ? <div className="empty-search">{query || status !== "all" ? t("noResults") : t("noReservations")}</div> : null}
    {result.ok && shown.length ? <>
      <div className="reservations-table table-wrap"><table className="data-table management-table"><thead><tr><th className="select-column"><span className="sr-only">{t("selectAll")}</span><input type="checkbox" checked={shown.length > 0 && shown.every((item) => selectedIds.has(item.id))} onChange={toggleAllShown} aria-label={t("selectAll")} /></th><th>{t("tableTime")}</th><th>{t("tableGuest")}</th><th>{t("tablePeople")}</th><th>{t("tableStatus")}</th><th>{t("tableSource")}</th><th>{t("tableRequests")}</th><th>{t("tableActions")}</th></tr></thead><tbody>
        {shown.map((item) => <tr key={item.id} className={details?.id === item.id ? "is-selected" : undefined}><td className="select-column"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} aria-label={t("selectBooking", { guest: item.guest })} /></td><td className="time-cell">{item.time}</td><td><button className="table-name-button" onClick={() => { setDetails(item); setError(""); }}><span className="guest-primary">{item.guest}</span><span className="guest-secondary">{item.email || item.phone || c("noContact")}</span></button></td><td>{item.guests}</td><td className="status-detail-cell"><span className={`status-pill ${statusClass[item.status]}`}>{statusName(item.status)}</span>{visitTags[item.id] ? <span className="visit-tag-pill">{t(`visitTags.${visitTags[item.id]}`)}</span> : null}{isLate(item, now) ? <span className="late-pill">{t("lateFlag")}</span> : null}<VisitTimer reservation={item} now={now} /></td><td>{sourceLabel(item.source)}</td><td>{item.note || <span className="detail-muted">{c("noRequests")}</span>}</td><td><button className="table-action-button" aria-label={t("detailsAction", { guest: item.guest })} onClick={() => { setDetails(item); setError(""); }}><MoreHorizontal size={17} /></button></td></tr>)}
      </tbody></table></div>
      <div className="booking-card-list">{shown.map((item) => <article className="reservation-card" key={item.id}><div className="reservation-card-top"><label className="reservation-card-select"><input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleSelected(item.id)} aria-label={t("selectBooking", { guest: item.guest })} /><span className="reservation-card-time">{item.date === today ? item.time : `${format(new Date(`${item.date}T12:00:00Z`), { day: "numeric", month: "short" })} · ${item.time}`}</span></label><span className="reservation-card-badges"><span className={`status-pill ${statusClass[item.status]}`}>{statusName(item.status)}</span>{isLate(item, now) ? <span className="late-pill">{t("lateFlag")}</span> : null}</span></div><VisitTimer reservation={item} now={now} /><button className="table-name-button card-name" onClick={() => setDetails(item)}><span className="guest-primary">{item.guest}</span><span className="guest-secondary">{item.email || item.phone || c("noContact")}</span></button><div className="reservation-card-bottom"><span className="reservation-card-meta"><UsersRound size={12} /> {item.guests} {c("personShort")} · {sourceLabel(item.source)} · {item.reference}</span><button className="button-quiet" onClick={() => setDetails(item)}>{t("details")}</button></div></article>)}</div>
    </> : null}</div>

    {details && !editing ? <aside className="reservation-detail-panel" aria-label={t("detailTitle")}>
      <header className="reservation-detail-header">
        <div className="reservation-detail-heading">
          <span className="detail-panel-eyebrow">{t("detailPanelTitle")}</span>
          <div className="detail-panel-reference"><span>{details.reference}</span><button type="button" className="drawer-menu-button" aria-label={t("moreActions")}><MoreHorizontal size={16} /></button></div>
        </div>
        <button type="button" className="icon-button" aria-label={c("close")} onClick={() => { setDetails(null); setError(""); }}><X size={16} /></button>
      </header>
      <div className="reservation-detail-scroll">
        <div className="detail-stack">
          <div className="detail-hero"><h3>{details.guest}</h3>{isLate(details, now) ? <span className="late-pill">{t("lateFlag")}</span> : null}</div>
          <div className="detail-row-list">
            <div className="detail-row"><CalendarDays size={16} /><span>{format(new Date(`${details.date}T12:00:00Z`), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span></div>
            <div className="detail-row"><Clock3 size={16} /><span>{details.time}</span></div>
            <div className="detail-row"><UsersRound size={16} /><span>{details.guests} {details.guests === 1 ? t("detailPeopleOne") : t("detailPeopleMany")}</span></div>
            <div className="detail-row detail-row-status"><CircleCheck size={16} /><span className={`status-pill ${statusClass[details.status]}`}>{statusName(details.status)}</span></div>
            <div className="detail-row"><Phone size={16} /><span>{details.phone || c("noContact")}</span>{details.phone ? <a className="detail-contact-button" href={`tel:${details.phone.replaceAll(" ", "")}`} aria-label={c("phone")}><Phone size={14} /></a> : null}</div>
            <div className="detail-row"><Mail size={16} /><span>{details.email || c("noEmail")}</span>{details.email ? <a className="detail-contact-button" href={`mailto:${details.email}`} aria-label={c("email")}><Mail size={14} /></a> : null}</div>
            <div className="detail-row"><Monitor size={16} /><span>{sourceLabel(details.source)}</span></div>
            {visitTags[details.id] ? <div className="detail-row"><MapPin size={16} /><span>{t("visitTagLabel")}: <strong>{t(`visitTags.${visitTags[details.id]}`)}</strong></span></div> : null}
          </div>
          <section className="detail-request"><h4><Pencil size={14} />{t("tableRequests")}</h4><p>{details.note || c("noSpecialRequests")}</p></section>
          <section className="detail-section"><h4><Clock3 size={14} />{t("timeline")}</h4><div className="detail-timeline">{details.arrivedAt ? <div><i /><span>{timestampLabel(details.arrivedAt)}</span><strong>{t("actualArrival")}</strong></div> : details.status === "arrived" ? <div><i /><span>—</span><strong>{t("arrivalTimeUnavailable")}</strong></div> : <p className="detail-muted">{t("noTimeline")}</p>}{details.departedAt ? <div><i /><span>{timestampLabel(details.departedAt)}</span><strong>{t("actualDeparture")}</strong></div> : null}{details.status === "arrived" ? <VisitTimer reservation={details} now={now} /> : null}</div></section>
          {error ? <p className="form-error" role="alert">{error}</p> : null}
        </div>
      </div>
      <footer className="reservation-detail-actions"><section className="detail-section detail-actions-section"><h4><CircleCheck size={14} />{t("actionsLabel")}</h4><div className="reservation-management-actions">
        {details.status === "pending" ? <button className="button-secondary" disabled={pending} onClick={() => performStatus("confirmed")}><Check size={14} />{t("actions.confirmed")}</button> : null}
        {(details.status === "pending" || details.status === "confirmed") ? <button className="button-secondary action-arrive" disabled={pending} onClick={() => performStatus("arrived")}><UserRoundCheck size={14} />{t("actions.arrived")}</button> : null}
        {details.status === "arrived" ? <button className="button-secondary action-free" disabled={pending} onClick={() => performStatus("completed")}><CircleCheck size={14} />{t("actions.free")}</button> : null}
        {(details.status === "pending" || details.status === "confirmed") && now >= Date.parse(details.startsAt) + lateThresholdMs ? <button className="button-secondary" disabled={pending} onClick={() => performStatus("no_show")}><UserX size={14} />{t("actions.noShow")}</button> : null}
        <div className="detail-secondary-actions">{(details.status === "pending" || details.status === "confirmed" || details.status === "arrived") ? <button className="button-secondary action-edit" disabled={pending} onClick={() => { setEditing(true); setError(""); }}><Pencil size={14} />{t("actions.edit")}</button> : null}{details.status === "pending" || details.status === "confirmed" || details.status === "arrived" ? <button className="button-secondary danger-action action-cancel" disabled={pending} onClick={() => performStatus("cancelled")}><Ban size={14} />{t("actions.cancel")}</button> : null}{details.status !== "cancelled" ? <button className="button-secondary danger-action action-delete" disabled={pending} onClick={() => setConfirmDelete(true)}><Trash2 size={14} />{t("actions.delete")}</button> : null}</div>
      </div>{pending ? <span className="detail-muted detail-saving"><LoaderCircle className="spin" size={14} /> {t("saving")}</span> : null}</section></footer>
    </aside> : null}</div>
    <Modal open={Boolean(arriveTarget)} variant="confirm" title={t("visitTagTitle")} subtitle={arriveTarget?.guest} onClose={() => { if (!pending) { setArriveTarget(null); setArriveTag(""); } }} footer={<><button type="button" className="button-secondary" disabled={pending} onClick={() => arriveTarget && submit({ action: "status", id: arriveTarget.id, status: "arrived" })}>{t("visitTagSkip")}</button><button type="button" className="button-primary" disabled={pending || !arriveTag} onClick={() => arriveTarget && submit({ action: "status", id: arriveTarget.id, status: "arrived" }, { visitTag: arriveTag || undefined })}>{pending ? <><LoaderCircle size={14} className="spin" />{t("saving")}</> : t("actions.arrived")}</button></>}> <p className="visit-tag-prompt">{t("visitTagDescription")}</p><div className="visit-tag-options">{visitTagIds.map((tag) => <button type="button" key={tag} className={`visit-tag-option${arriveTag === tag ? " is-selected" : ""}`} onClick={() => setArriveTag(tag)}><MapPin size={14} />{t(`visitTags.${tag}`)}</button>)}</div></Modal>
    {creating || editing ? <ReservationEditor key={creating ? "create" : `edit-${details?.id ?? "none"}`} mode={creating ? "create" : "edit"} initial={details} today={key(date)} error={error} busy={pending} onClose={() => { setCreating(false); setEditing(false); setError(""); }} onSubmit={submit} /> : null}
    <Modal open={confirmCancel} variant="confirm" title={t("cancelTitle")} subtitle={details?.guest} onClose={() => setConfirmCancel(false)} footer={<><button className="button-secondary" onClick={() => setConfirmCancel(false)}>{t("keep")}</button><button className="button-danger" disabled={pending} onClick={() => details && submit({ action: "status", id: details.id, status: "cancelled" })}>{pending ? t("saving") : t("actions.cancel")}</button></>}>
      <p className="cancel-confirm-copy">{t("cancelDescription")}</p><p className="detail-muted">{t("capacityRelease")}</p>
    </Modal>
    <Modal open={confirmDelete} variant="confirm" title={t("deleteTitle")} subtitle={details?.guest} onClose={() => setConfirmDelete(false)} footer={<><button className="button-secondary" disabled={pending} onClick={() => setConfirmDelete(false)}>{c("cancel")}</button><button className="button-danger" disabled={pending} onClick={() => details && submit({ action: "status", id: details.id, status: "cancelled" }, { removeFromView: true })}>{pending ? <><LoaderCircle size={14} className="spin" />{t("saving")}</> : <><Trash2 size={14} />{t("deleteConfirm")}</>}</button></>}>
      <p className="cancel-confirm-copy">{t("deleteDescription")}</p>
    </Modal>
    <Modal open={confirmBulkDelete} variant="confirm" title={t("bulkDeleteTitle")} subtitle={t("selectedCount", { count: selectedIds.size })} onClose={() => { if (!bulkDeleting) setConfirmBulkDelete(false); }} footer={<><button className="button-secondary" disabled={bulkDeleting} onClick={() => setConfirmBulkDelete(false)}>{c("cancel")}</button><button className="button-danger" disabled={bulkDeleting} onClick={() => void deleteSelected()}>{bulkDeleting ? <><LoaderCircle size={14} className="spin" />{t("saving")}</> : <><Trash2 size={14} />{t("deleteSelected")}</>}</button></>}>
      <p className="cancel-confirm-copy">{t("bulkDeleteDescription")}</p>
    </Modal>
    <Toast message={message} onDismiss={() => setMessage("")} />
  </>;
}

function ReservationEditor({ mode, initial, today, error, busy, onClose, onSubmit }: {
  mode: "create" | "edit"; initial: LiveReservation | null; today: string; error: string; busy: boolean; onClose: () => void;
  onSubmit: (input: Parameters<typeof manageReservation>[0]) => void;
}) {
  const t = useTranslations("Reservations"); const c = useTranslations("Common");
  const [guest, setGuest] = useState(initial?.guest ?? ""); const [email, setEmail] = useState(initial?.email ?? ""); const [phone, setPhone] = useState(initial?.phone ?? ""); const [date, setDate] = useState(initial?.date ?? today); const [time, setTime] = useState(initial?.time ?? "10:00"); const [guests, setGuests] = useState(initial?.guests ?? 2); const [source, setSource] = useState<"phone" | "walk_in">(initial?.source === "walk_in" ? "walk_in" : "phone"); const [note, setNote] = useState(initial?.note ?? "");
  const [formError, setFormError] = useState("");
  function save() {
    setFormError("");
    if (!guest.trim() && mode === "create") { setFormError(t("errors.nameRequired")); return; }
    if (mode === "create" && !email.trim() && !phone.trim()) { setFormError(t("errors.contactRequired")); return; }
    if (mode === "create" && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setFormError(t("errors.emailInvalid")); return; }
    onSubmit({ action: mode, id: initial?.id, guest: mode === "create" ? guest : undefined, email: mode === "create" ? email : undefined, phone: mode === "create" ? phone : undefined, date, time, guests, source: mode === "create" ? source : undefined, note });
  }
  return <Modal open title={mode === "create" ? t("createTitle") : t("editTitle")} subtitle={mode === "create" ? t("createSubtitle") : initial?.reference} onClose={onClose} footer={<><button className="button-secondary" disabled={busy} onClick={onClose}>{c("cancel")}</button><button className="button-primary" disabled={busy} onClick={save}>{busy ? <><LoaderCircle size={14} className="spin" />{t("saving")}</> : mode === "create" ? t("actions.create") : t("saveChanges")}</button></>}>
    {mode === "create" ? <div className="source-segmented" role="group" aria-label={t("bookingSource")}><button type="button" className={source === "phone" ? "is-active" : ""} onClick={() => setSource("phone")}><Phone size={14} />{c("telephone")}</button><button type="button" className={source === "walk_in" ? "is-active" : ""} onClick={() => setSource("walk_in")}><UsersRound size={14} />{c("walkIn")}</button></div> : null}
    <div className="form-grid">
      {mode === "create" ? <><div className="form-field"><label htmlFor="staffGuest">{c("name")} *</label><input id="staffGuest" autoComplete="name" value={guest} onChange={(e) => setGuest(e.target.value)} maxLength={160} /></div><div className="form-field"><label htmlFor="staffPhone">{c("phone")}</label><input id="staffPhone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} /></div><div className="form-field is-full"><label htmlFor="staffEmail">{c("email")}</label><input id="staffEmail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} /></div></> : null}
      <div className="form-field"><label htmlFor="staffDate"><CalendarDays size={13} />{c("date")}</label><input id="staffDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div><div className="form-field"><label htmlFor="staffTime"><Clock3 size={13} />{c("time")}</label><input id="staffTime" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div><div className="form-field"><label htmlFor="staffGuests"><UsersRound size={13} />{c("guests")}</label><select id="staffGuests" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>{Array.from({ length: 30 }, (_, i) => i + 1).map((number) => <option key={number} value={number}>{number}</option>)}</select></div><div className="form-field is-full"><label htmlFor="staffNote"><Pencil size={13} />{c("note")}</label><textarea id="staffNote" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder={c("requestPlaceholder")} /></div>
    </div>
    {error || formError ? <p className="form-error" role="alert">{error || formError}</p> : null}
  </Modal>;
}
