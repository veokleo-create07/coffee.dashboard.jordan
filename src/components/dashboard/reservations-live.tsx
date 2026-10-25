"use client";

import { useEffect, useState, useTransition } from "react";
import { Ban, CalendarDays, Check, ChevronLeft, ChevronRight, CircleCheck, Clock3, LoaderCircle, Mail, Monitor, MoreHorizontal, Pencil, Phone, Plus, Search, UserRoundCheck, UsersRound, UserX, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { MetricCard, PageIntro } from "@/components/dashboard/primitives";
import { Modal, Toast } from "@/components/dashboard/dialog";
import { checkReservationAvailability, loadReservations, manageReservation, type BookingSource, type LiveReservation, type ReservationActionResult, type ReservationLoadResult, type ReservationStatus } from "@/app/dashboard/actions";

type StatusFilter = "all" | LiveReservation["status"];
const statusClass: Record<ReservationStatus, string> = { pending: "status-pending", confirmed: "status-confirmed", arrived: "status-arrived", completed: "status-completed", cancelled: "status-cancelled", no_show: "status-no-show" };
const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const activeStatuses = new Set<ReservationStatus>(["pending", "confirmed", "arrived"]);
const capacityStatuses = new Set<ReservationStatus>(["pending", "confirmed", "arrived", "completed"]);
const errorKeys: Record<string, string> = { INVALID_INPUT: "invalidInput", CAPACITY_CONFIG: "capacityConfig", PAST: "past", BOOKING_WINDOW: "bookingWindow", GUEST_LIMIT: "guestLimit", CLOSED: "closed", OUTSIDE_HOURS: "outsideHours", INVALID_SLOT: "invalidSlot", RESERVATION_FULL: "full", ABSOLUTE_CAPACITY: "absoluteCapacity", RULE_EXCEPTION_REQUIRED: "exceptionRequired", RULE_EXCEPTION_FORBIDDEN: "exceptionForbidden", NOT_FOUND: "notFound", INVALID_TRANSITION: "invalidTransition", NO_SHOW_TOO_EARLY: "noShowTooEarly", NOT_STAFF: "notStaff", UNAVAILABLE: "unavailable", VISIT_STILL_ACTIVE: "visitStillActive", OCCUPANCY_TIMESTAMP_FORBIDDEN: "occupancyTimestampForbidden" };
const lateThresholdMs = 15 * 60_000;
const visitDurationMs = 90 * 60_000;
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

export function ReservationsLive({ today, initialStart, initialEnd, initial, initialDate }: { today: string; initialStart: string; initialEnd: string; initial: ReservationLoadResult; initialDate?: string }) {
  const t = useTranslations("Reservations"); const c = useTranslations("Common"); const locale = useLocale();
  const [date, setDate] = useState(new Date(`${initialDate ?? today}T12:00:00`)); const [status, setStatus] = useState<StatusFilter>("all"); const [query, setQuery] = useState("");
  const [reservations, setReservations] = useState(initial.ok ? initial.reservations : []); const [result, setResult] = useState(initial); const [loadedRange, setLoadedRange] = useState({ start: initialStart, end: initialEnd });
  const [details, setDetails] = useState<LiveReservation | null>(null); const [editing, setEditing] = useState(false); const [creating, setCreating] = useState(false); const [confirmCancel, setConfirmCancel] = useState(false); const [capacityRequired, setCapacityRequired] = useState(false);
  const [pending, startTransition] = useTransition(); const [message, setMessage] = useState(""); const [error, setError] = useState(""); const [now, setNow] = useState(() => Date.now());
  const start = key(date); const end = start;

  async function refresh() {
    const next = await loadReservations(start, end); setResult(next);
    if (next.ok) { setReservations(next.reservations); setLoadedRange({ start, end }); }
    if (details && next.ok) setDetails(next.reservations.find((item) => item.id === details.id) ?? null);
  }
  useEffect(() => {
    if (start >= loadedRange.start && end <= loadedRange.end) return;
    let active = true;
    void loadReservations(start, end).then((next) => { if (!active) return; setResult(next); if (next.ok) { setReservations(next.reservations); setLoadedRange({ start, end }); } });
    return () => { active = false; };
  }, [end, loadedRange.end, loadedRange.start, start]);
  useEffect(() => {
    let active = true;
    const poll = async () => {
      const next = await loadReservations(start, end);
      if (!active) return;
      setResult(next);
      if (next.ok) {
        setReservations(next.reservations);
        setLoadedRange({ start, end });
        setDetails((current) => current ? next.reservations.find((item) => item.id === current.id) ?? null : null);
      }
    };
    const interval = window.setInterval(() => { void poll(); }, 15_000);
    const clock = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => { active = false; window.clearInterval(interval); window.clearInterval(clock); };
  }, [end, start]);

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
  function step(direction: -1 | 1) { setDate((current) => { const next = new Date(current); next.setDate(next.getDate() + direction); return next; }); }
  function submit(values: Parameters<typeof manageReservation>[0]) {
    setError(""); startTransition(async () => {
      const response: ReservationActionResult = await manageReservation(values);
      if (!response.ok) { if (response.code === "RULE_EXCEPTION_REQUIRED") { setCapacityRequired(true); setError(""); } else setError(translatedError(response.code)); return; }
      setCreating(false); setEditing(false); setConfirmCancel(false); setCapacityRequired(false); setMessage(t(`success.${values.action === "status" ? values.status : values.action}`));
      await refresh();
    });
  }
  function performStatus(next: NonNullable<Parameters<typeof manageReservation>[0]["status"]>) {
    if (!details) return;
    if (next === "cancelled") { setConfirmCancel(true); return; }
    submit({ action: "status", id: details.id, status: next });
  }
  const sourceLabel = (source: BookingSource) => source === "website" ? c("online") : source === "phone" ? c("telephone") : c("walkIn");

  return <>
    <PageIntro eyebrow="" title={t("title")} description={title} action={<div className="reservation-header-actions"><div className="date-controls"><button className="icon-button" aria-label={t("previousDay")} onClick={() => step(-1)}><ChevronLeft size={16} /></button><span className="range-date"><CalendarDays size={16} />{title}</span><button className="icon-button" aria-label={t("nextDay")} onClick={() => step(1)}><ChevronRight size={16} /></button></div><button className="button-quiet today-button" onClick={() => setDate(new Date(`${today}T12:00:00`))}>{c("today")}</button><button className="button-primary new-booking-button" onClick={() => { setCreating(true); setError(""); }}><Plus size={16} />{c("newReservation")}</button></div>} />
    <section className="metric-grid reservations-metrics" aria-label={t("periodLabel")}>
      <MetricCard label={t("count")} value={result.ok ? periodReservations.length : "—"} detail={t("liveDataLabel")} icon={<CalendarDays size={18} />} />
      <MetricCard label={t("expectedGuests")} value={result.ok ? expectedGuests : "—"} detail={t("activeBookingsOnly")} icon={<UsersRound size={18} />} tone="sage" />
      <MetricCard label={t("currentlySeated")} value={result.ok ? occupiedGuests : "—"} detail={t("liveDataLabel")} icon={<UserRoundCheck size={18} />} tone="sage" />
      <MetricCard label={t("noShows")} value={result.ok ? noShows : "—"} detail={t("periodNoShow")} icon={<UserX size={18} />} tone="stone" />
    </section>

    <div className="reservation-toolbar"><div className="toolbar-lower"><label className="search-field"><Search size={14} /><input aria-label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <select className="select-control" aria-label={t("filter")} value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
        <option value="all">{c("all")}</option>{(["pending", "confirmed", "arrived", "completed", "cancelled", "no_show"] as const).map((item) => <option key={item} value={item}>{statusName(item)}</option>)}
      </select></div></div>
    <div className={`reservation-workspace${details && !editing ? " has-details" : ""}`}><div className="reservation-list-column"><div className="reservations-summary"><span className="result-count">{t("resultCount", { count: shown.length })}</span><span className="result-count">{t("liveDataLabel")}</span></div>
    {!result.ok ? <div className="live-data-alert" role="alert">{errorText}</div> : null}
    {loading ? <div className="live-empty-state" role="status">{t("loading")}</div> : null}
    {result.ok && !loading && !shown.length ? <div className="empty-search">{query || status !== "all" ? t("noResults") : t("noReservations")}</div> : null}
    {result.ok && shown.length ? <>
      <div className="reservations-table table-wrap"><table className="data-table management-table"><thead><tr><th>{t("tableTime")}</th><th>{t("tableGuest")}</th><th>{t("tablePeople")}</th><th>{t("tableStatus")}</th><th>{t("tableSource")}</th><th>{t("tableRequests")}</th><th>{t("tableActions")}</th></tr></thead><tbody>
        {shown.map((item) => <tr key={item.id} className={details?.id === item.id ? "is-selected" : undefined}><td className="time-cell">{item.time}</td><td><button className="table-name-button" onClick={() => { setDetails(item); setError(""); }}><span className="guest-primary">{item.guest}</span><span className="guest-secondary">{item.email || item.phone || c("noContact")}</span></button></td><td>{item.guests}</td><td className="status-detail-cell"><span className={`status-pill ${statusClass[item.status]}`}>{statusName(item.status)}</span>{isLate(item, now) ? <span className="late-pill">{t("lateFlag")}</span> : null}<VisitTimer reservation={item} now={now} /></td><td>{sourceLabel(item.source)}</td><td>{item.note || <span className="detail-muted">{c("noRequests")}</span>}</td><td><button className="table-action-button" aria-label={t("detailsAction", { guest: item.guest })} onClick={() => { setDetails(item); setError(""); }}><MoreHorizontal size={17} /></button></td></tr>)}
      </tbody></table></div>
      <div className="booking-card-list">{shown.map((item) => <article className="reservation-card" key={item.id}><div className="reservation-card-top"><span className="reservation-card-time">{item.date === today ? item.time : `${format(new Date(`${item.date}T12:00:00Z`), { day: "numeric", month: "short" })} · ${item.time}`}</span><span className="reservation-card-badges"><span className={`status-pill ${statusClass[item.status]}`}>{statusName(item.status)}</span>{isLate(item, now) ? <span className="late-pill">{t("lateFlag")}</span> : null}</span></div><VisitTimer reservation={item} now={now} /><button className="table-name-button card-name" onClick={() => setDetails(item)}><span className="guest-primary">{item.guest}</span><span className="guest-secondary">{item.email || item.phone || c("noContact")}</span></button><div className="reservation-card-bottom"><span className="reservation-card-meta"><UsersRound size={12} /> {item.guests} {c("personShort")} · {sourceLabel(item.source)} · {item.reference}</span><button className="button-quiet" onClick={() => setDetails(item)}>{t("details")}</button></div></article>)}</div>
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
        <div className="detail-secondary-actions">{(details.status === "pending" || details.status === "confirmed" || details.status === "arrived") ? <button className="button-secondary action-edit" disabled={pending} onClick={() => { setEditing(true); setError(""); }}><Pencil size={14} />{t("actions.edit")}</button> : null}{(details.status === "pending" || details.status === "confirmed") ? <button className="button-secondary danger-action action-cancel" disabled={pending} onClick={() => performStatus("cancelled")}><Ban size={14} />{t("actions.cancel")}</button> : null}</div>
      </div>{pending ? <span className="detail-muted detail-saving"><LoaderCircle className="spin" size={14} /> {t("saving")}</span> : null}</section></footer>
    </aside> : null}</div>
    {creating || editing ? <ReservationEditor key={creating ? "create" : `edit-${details?.id ?? "none"}`} mode={creating ? "create" : "edit"} initial={details} today={key(date)} reservations={reservations} error={error} busy={pending} capacityRequired={capacityRequired} onCapacityRequired={() => setCapacityRequired(true)} onClose={() => { setCreating(false); setEditing(false); setCapacityRequired(false); setError(""); }} onSubmit={submit} onCheck={checkReservationAvailability} errorFor={translatedError} /> : null}
    <Modal open={confirmCancel} variant="confirm" title={t("cancelTitle")} subtitle={details?.guest} onClose={() => setConfirmCancel(false)} footer={<><button className="button-secondary" onClick={() => setConfirmCancel(false)}>{t("keep")}</button><button className="button-danger" disabled={pending} onClick={() => details && submit({ action: "status", id: details.id, status: "cancelled" })}>{pending ? t("saving") : t("actions.cancel")}</button></>}>
      <p className="cancel-confirm-copy">{t("cancelDescription")}</p><p className="detail-muted">{t("capacityRelease")}</p>
    </Modal>
    <Toast message={message} onDismiss={() => setMessage("")} />
  </>;
}

function ReservationEditor({ mode, initial, today, reservations, error, busy, capacityRequired, onCapacityRequired, onClose, onSubmit, onCheck, errorFor }: {
  mode: "create" | "edit"; initial: LiveReservation | null; today: string; reservations: LiveReservation[]; error: string; busy: boolean; capacityRequired: boolean; onCapacityRequired: () => void; onClose: () => void;
  onSubmit: (input: Parameters<typeof manageReservation>[0]) => void;
  onCheck: typeof checkReservationAvailability; errorFor: (code: string) => string;
}) {
  const t = useTranslations("Reservations"); const c = useTranslations("Common");
  const [guest, setGuest] = useState(initial?.guest ?? ""); const [email, setEmail] = useState(initial?.email ?? ""); const [phone, setPhone] = useState(initial?.phone ?? ""); const [date, setDate] = useState(initial?.date ?? today); const [time, setTime] = useState(initial?.time ?? "10:00"); const [guests, setGuests] = useState(initial?.guests ?? 2); const [source, setSource] = useState<"phone" | "walk_in">(initial?.source === "walk_in" ? "walk_in" : "phone"); const [note, setNote] = useState(initial?.note ?? "");
  const [checking, setChecking] = useState(false); const [exceptionConfirmed, setExceptionConfirmed] = useState(false); const [reason, setReason] = useState(""); const [formError, setFormError] = useState("");
  const projectedGuests = reservations.filter((item) => item.id !== initial?.id && item.date === date && capacityStatuses.has(item.status) && Date.parse(item.startsAt) < Date.parse(`${date}T${time}:00`) + 90 * 60_000 && Date.parse(item.startsAt) + 90 * 60_000 > Date.parse(`${date}T${time}:00`)).reduce((sum, item) => sum + item.guests, guests);
  async function save() {
    setFormError("");
    if (!guest.trim() && mode === "create") { setFormError(t("errors.nameRequired")); return; }
    if (mode === "create" && !email.trim() && !phone.trim()) { setFormError(t("errors.contactRequired")); return; }
    if (mode === "create" && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setFormError(t("errors.emailInvalid")); return; }
    if (capacityRequired && (!exceptionConfirmed || reason.trim().length < 10)) { setFormError(t("errors.reasonRequired")); return; }
    setChecking(true);
    const availability = await onCheck({ date, time, guests, source: mode === "create" ? source : initial?.source ?? "website", excludeId: mode === "edit" ? initial?.id : undefined });
    if (!availability.ok) { setChecking(false); setFormError(errorFor(availability.code)); return; }
    if (!availability.available && (!availability.canOverride || availability.reason === "PAST")) { setChecking(false); setFormError(errorFor(availability.reason)); return; }
    if (!availability.available && availability.canOverride) { onCapacityRequired(); setChecking(false); if (!exceptionConfirmed) { setFormError(t("capacityWarning", { guests: projectedGuests })); return; } }
    onSubmit({ action: mode, id: initial?.id, guest: mode === "create" ? guest : undefined, email: mode === "create" ? email : undefined, phone: mode === "create" ? phone : undefined, date, time, guests, source: mode === "create" ? source : undefined, note, exceptionReason: capacityRequired ? reason : undefined });
  }
  return <Modal open title={mode === "create" ? t("createTitle") : t("editTitle")} subtitle={mode === "create" ? t("createSubtitle") : initial?.reference} onClose={onClose} footer={<><button className="button-secondary" disabled={busy} onClick={onClose}>{c("cancel")}</button><button className="button-primary" disabled={busy || checking} onClick={save}>{busy ? <><LoaderCircle size={14} className="spin" />{t("saving")}</> : mode === "create" ? t("actions.create") : t("saveChanges")}</button></>}>
    {mode === "create" ? <div className="source-segmented" role="group" aria-label={t("bookingSource")}><button type="button" className={source === "phone" ? "is-active" : ""} onClick={() => setSource("phone")}><Phone size={14} />{c("telephone")}</button><button type="button" className={source === "walk_in" ? "is-active" : ""} onClick={() => setSource("walk_in")}><UsersRound size={14} />{c("walkIn")}</button></div> : null}
    <div className="form-grid">
      {mode === "create" ? <><div className="form-field"><label htmlFor="staffGuest">{c("name")} *</label><input id="staffGuest" autoComplete="name" value={guest} onChange={(e) => setGuest(e.target.value)} maxLength={160} /></div><div className="form-field"><label htmlFor="staffPhone">{c("phone")}</label><input id="staffPhone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} /></div><div className="form-field is-full"><label htmlFor="staffEmail">{c("email")}</label><input id="staffEmail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} /></div></> : null}
      <div className="form-field"><label htmlFor="staffDate"><CalendarDays size={13} />{c("date")}</label><input id="staffDate" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div><div className="form-field"><label htmlFor="staffTime"><Clock3 size={13} />{c("time")}</label><input id="staffTime" type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div><div className="form-field"><label htmlFor="staffGuests"><UsersRound size={13} />{c("guests")}</label><select id="staffGuests" value={guests} onChange={(e) => setGuests(Number(e.target.value))}>{Array.from({ length: 30 }, (_, i) => i + 1).map((number) => <option key={number} value={number}>{number}</option>)}</select></div><div className="form-field is-full"><label htmlFor="staffNote"><Pencil size={13} />{c("note")}</label><textarea id="staffNote" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder={c("requestPlaceholder")} /></div>
    </div>
    {capacityRequired ? <div className="exception-panel capacity-warning" role="alert"><p><strong>{t("capacityWarning", { guests: projectedGuests })}</strong></p><p>{t("exceptionDescription")}</p><label className="exception-checkbox"><input type="checkbox" checked={exceptionConfirmed} onChange={(e) => { setExceptionConfirmed(e.target.checked); setFormError(""); }} />{t("allowException")}</label><div className="form-field"><label htmlFor="exceptionReason">{t("exceptionReason")}</label><textarea id="exceptionReason" value={reason} minLength={10} maxLength={1000} onChange={(e) => { setReason(e.target.value); setFormError(""); }} /></div></div> : null}
    {error || formError ? <p className="form-error" role="alert">{error || formError}</p> : null}
  </Modal>;
}
