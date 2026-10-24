"use client";

import { useEffect, useState, useTransition } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Search, UsersRound, Plus, LoaderCircle, Pencil, Phone, Check, UserRoundCheck, Ban, CircleCheck, UserX } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { MetricCard, PageIntro } from "@/components/dashboard/primitives";
import { Modal, Toast } from "@/components/dashboard/dialog";
import { checkReservationAvailability, loadReservations, manageReservation, type BookingSource, type LiveReservation, type ReservationActionResult, type ReservationLoadResult, type ReservationStatus } from "@/app/dashboard/actions";

type Range = "day" | "week" | "month";
type StatusFilter = "all" | LiveReservation["status"];
const statusClass: Record<ReservationStatus, string> = { pending: "status-pending", confirmed: "status-confirmed", arrived: "status-arrived", completed: "status-completed", cancelled: "status-cancelled", no_show: "status-no-show" };
const key = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const startOfWeek = (date: Date) => { const value = new Date(date); value.setDate(value.getDate() - ((value.getDay() + 6) % 7)); return value; };
const endOfWeek = (date: Date) => { const value = startOfWeek(date); value.setDate(value.getDate() + 6); return value; };
const monthBounds = (date: Date) => ({ start: new Date(date.getFullYear(), date.getMonth(), 1), end: new Date(date.getFullYear(), date.getMonth() + 1, 0) });
const activeStatuses = new Set<ReservationStatus>(["pending", "confirmed", "arrived"]);
const errorKeys: Record<string, string> = { INVALID_INPUT: "invalidInput", CAPACITY_CONFIG: "capacityConfig", PAST: "past", BOOKING_WINDOW: "bookingWindow", GUEST_LIMIT: "guestLimit", CLOSED: "closed", OUTSIDE_HOURS: "outsideHours", INVALID_SLOT: "invalidSlot", RESERVATION_FULL: "full", RULE_EXCEPTION_REQUIRED: "exceptionRequired", RULE_EXCEPTION_FORBIDDEN: "exceptionForbidden", NOT_FOUND: "notFound", INVALID_TRANSITION: "invalidTransition", NO_SHOW_TOO_EARLY: "noShowTooEarly", NOT_STAFF: "notStaff", UNAVAILABLE: "unavailable" };

export function ReservationsLive({ today, initialStart, initialEnd, initial }: { today: string; initialStart: string; initialEnd: string; initial: ReservationLoadResult }) {
  const t = useTranslations("Reservations"); const c = useTranslations("Common"); const locale = useLocale();
  const [date, setDate] = useState(new Date(`${today}T12:00:00`)); const [range, setRange] = useState<Range>("day"); const [status, setStatus] = useState<StatusFilter>("all"); const [query, setQuery] = useState("");
  const [reservations, setReservations] = useState(initial.ok ? initial.reservations : []); const [result, setResult] = useState(initial); const [loadedRange, setLoadedRange] = useState({ start: initialStart, end: initialEnd });
  const [details, setDetails] = useState<LiveReservation | null>(null); const [editing, setEditing] = useState(false); const [creating, setCreating] = useState(false); const [confirmCancel, setConfirmCancel] = useState(false);
  const [pending, startTransition] = useTransition(); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const bounds = range === "day" ? { start: date, end: date } : range === "week" ? { start: startOfWeek(date), end: endOfWeek(date) } : monthBounds(date);
  const start = key(bounds.start); const end = key(bounds.end);

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

  const periodReservations = reservations.filter((item) => item.date >= start && item.date <= end);
  const shown = periodReservations.filter((item) => {
    if (status !== "all" && item.status !== status) return false;
    const term = query.trim().toLocaleLowerCase(locale);
    return !term || `${item.guest} ${item.email ?? ""} ${item.phone ?? ""} ${item.reference}`.toLocaleLowerCase(locale).includes(term);
  });
  const loading = (start < loadedRange.start || end > loadedRange.end) && result.ok;
  const expectedGuests = periodReservations.filter((item) => activeStatuses.has(item.status)).reduce((sum, item) => sum + item.guests, 0);
  const format = (value: Date, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { ...options, timeZone: "Europe/Berlin" }).format(value);
  const title = range === "day" ? format(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" }) : range === "week" ? `${format(bounds.start, { day: "numeric", month: "short" })} – ${format(bounds.end, { day: "numeric", month: "short", year: "numeric" })}` : format(date, { month: "long", year: "numeric" });
  const statusName = (value: ReservationStatus) => c(value === "no_show" ? "noShow" : value);
  const errorText = !result.ok ? result.reason === "unauthorized" ? c("reservationUnauthorized") : result.reason === "permission" ? c("reservationPermission") : c("reservationLoadError") : "";
  const translatedError = (code: string) => t(`errors.${errorKeys[code] ?? "unavailable"}`);
  function step(direction: -1 | 1) { setDate((current) => { const next = new Date(current); if (range === "month") next.setMonth(next.getMonth() + direction); else next.setDate(next.getDate() + direction * (range === "week" ? 7 : 1)); return next; }); }
  function submit(values: Parameters<typeof manageReservation>[0]) {
    setError(""); startTransition(async () => {
      const response: ReservationActionResult = await manageReservation(values);
      if (!response.ok) { setError(translatedError(response.code)); return; }
      setCreating(false); setEditing(false); setConfirmCancel(false); setMessage(t(`success.${values.action === "status" ? values.status : values.action}`));
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
    <PageIntro eyebrow={t("eyebrow")} title={t("title")} description={t("description")} />
    <section className="metric-grid reservations-metrics" aria-label={t("periodLabel")}>
      <MetricCard label={t("count")} value={result.ok ? periodReservations.length : "—"} detail={title} icon={<CalendarDays size={15} />} />
      <MetricCard label={t("expectedGuests")} value={result.ok ? expectedGuests : "—"} detail={t("activeBookingsOnly")} icon={<UsersRound size={15} />} tone="sage" />
      <MetricCard label={c("pending")} value={result.ok ? periodReservations.filter((item) => item.status === "pending").length : "—"} detail={t("liveDataLabel")} icon={<Clock3 size={15} />} tone="gold" />
      <MetricCard label={c("cancelled")} value={result.ok ? periodReservations.filter((item) => item.status === "cancelled").length : "—"} detail={t("liveDataLabel")} icon={<CalendarDays size={15} />} tone="stone" />
    </section>

    <div className="reservation-toolbar"><div className="toolbar-upper">
      <div className="range-switcher" aria-label={t("periodLabel")}>{(["day", "week", "month"] as const).map((item) => <button type="button" key={item} className={`range-button${range === item ? " is-active" : ""}`} onClick={() => setRange(item)}>{t(item)}</button>)}</div>
      <div className="date-controls"><button className="icon-button" aria-label={t("previous")} onClick={() => step(-1)}><ChevronLeft size={15} /></button><span className="range-date">{title}</span><button className="icon-button" aria-label={t("next")} onClick={() => step(1)}><ChevronRight size={15} /></button><button className="button-quiet today-button" onClick={() => setDate(new Date(`${today}T12:00:00`))}>{c("today")}</button></div>
      <button className="button-primary new-booking-button" onClick={() => { setCreating(true); setError(""); }}><Plus size={14} />{c("newReservation")}</button>
    </div><div className="toolbar-lower"><label className="search-field"><Search size={14} /><input aria-label={t("searchLabel")} placeholder={t("searchPlaceholder")} value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <select className="select-control" aria-label={t("filter")} value={status} onChange={(event) => setStatus(event.target.value as StatusFilter)}>
        <option value="all">{c("all")}</option>{(["pending", "confirmed", "arrived", "completed", "cancelled", "no_show"] as const).map((item) => <option key={item} value={item}>{statusName(item)}</option>)}
      </select></div></div>
    <div className="reservations-summary"><span className="result-count">{t("resultCount", { count: shown.length })}</span><span className="result-count">{t("liveDataLabel")}</span></div>
    {!result.ok ? <div className="live-data-alert" role="alert">{errorText}</div> : null}
    {loading ? <div className="live-empty-state" role="status">{t("loading")}</div> : null}
    {result.ok && !loading && !shown.length ? <div className="empty-search">{query || status !== "all" ? t("noResults") : t("noReservations")}</div> : null}
    {result.ok && shown.length ? <>
      <div className="reservations-table table-wrap"><table className="data-table management-table"><thead><tr><th>{t("tableTime")}</th><th>{t("tableGuest")}</th><th>{t("tablePeople")}</th><th>{t("tableReference")}</th><th>{t("tableStatus")}</th><th>{t("tableSource")}</th><th>{t("tableRequests")}</th></tr></thead><tbody>
        {shown.map((item) => <tr key={item.id}><td className="time-cell">{item.time}</td><td><button className="table-name-button" onClick={() => { setDetails(item); setError(""); }}><span className="guest-primary">{item.guest}</span><span className="guest-secondary">{item.email || item.phone || c("noContact")}</span></button></td><td>{item.guests}</td><td className="source-tag">{item.reference}</td><td><span className={`status-pill ${statusClass[item.status]}`}>{statusName(item.status)}</span></td><td>{sourceLabel(item.source)}</td><td>{item.note || <span className="detail-muted">{c("noRequests")}</span>}</td></tr>)}
      </tbody></table></div>
      <div className="booking-card-list">{shown.map((item) => <article className="reservation-card" key={item.id}><div className="reservation-card-top"><span className="reservation-card-time">{item.date === today ? item.time : `${format(new Date(`${item.date}T12:00:00Z`), { day: "numeric", month: "short" })} · ${item.time}`}</span><span className={`status-pill ${statusClass[item.status]}`}>{statusName(item.status)}</span></div><button className="table-name-button card-name" onClick={() => setDetails(item)}><span className="guest-primary">{item.guest}</span><span className="guest-secondary">{item.email || item.phone || c("noContact")}</span></button><div className="reservation-card-bottom"><span className="reservation-card-meta"><UsersRound size={12} /> {item.guests} {c("personShort")} · {sourceLabel(item.source)} · {item.reference}</span><button className="button-quiet" onClick={() => setDetails(item)}>{t("details")}</button></div></article>)}</div>
    </> : null}

    <Modal open={Boolean(details) && !editing} title={t("detailTitle")} subtitle={details?.reference} onClose={() => { setDetails(null); setError(""); }} footer={<button className="button-secondary" onClick={() => setDetails(null)}>{c("close")}</button>}>
      {details ? <div className="detail-stack"><div className="detail-name"><div><strong>{details.guest}</strong><span>{details.guests} {details.guests === 1 ? t("detailPeopleOne") : t("detailPeopleMany")}</span></div></div><div className="detail-line"><CalendarDays size={15} />{format(new Date(`${details.date}T12:00:00Z`), { weekday: "long", day: "numeric", month: "long", year: "numeric" })} · {details.time}</div>{details.email ? <div className="detail-line">{details.email}</div> : null}{details.phone ? <div className="detail-line"><Phone size={14} />{details.phone}</div> : null}<div className="detail-line"><span className={`status-pill ${statusClass[details.status]}`}>{statusName(details.status)}</span><span>{t("sourcePrefix")} {sourceLabel(details.source)}</span></div><div className="detail-line"><strong>{t("tableRequests")}</strong></div>{details.note ? <div className="profile-note">{details.note}</div> : <div className="detail-muted">{c("noRequests")}</div>}
        {error ? <p className="form-error" role="alert">{error}</p> : null}<div className="reservation-management-actions">
          {details.status === "pending" ? <button className="button-secondary" disabled={pending} onClick={() => performStatus("confirmed")}><Check size={14} />{t("actions.confirmed")}</button> : null}
          {(details.status === "pending" || details.status === "confirmed") ? <button className="button-secondary" disabled={pending} onClick={() => performStatus("arrived")}><UserRoundCheck size={14} />{t("actions.arrived")}</button> : null}
          {(details.status === "pending" || details.status === "confirmed" || details.status === "arrived") ? <button className="button-secondary" disabled={pending} onClick={() => { setEditing(true); setError(""); }}><Pencil size={14} />{t("actions.edit")}</button> : null}
          {(details.status === "confirmed" || details.status === "arrived") ? <button className="button-secondary" disabled={pending} onClick={() => performStatus("completed")}><CircleCheck size={14} />{t("actions.completed")}</button> : null}
          {(details.status === "pending" || details.status === "confirmed" || details.status === "arrived") ? <><button className="button-secondary" disabled={pending} onClick={() => performStatus("no_show")}><UserX size={14} />{t("actions.noShow")}</button><button className="button-secondary danger-action" disabled={pending} onClick={() => performStatus("cancelled")}><Ban size={14} />{t("actions.cancel")}</button></> : null}
        </div>{pending ? <span className="detail-muted"><LoaderCircle className="spin" size={14} /> {t("saving")}</span> : null}</div> : null}
    </Modal>
    {creating || editing ? <ReservationEditor key={creating ? "create" : `edit-${details?.id ?? "none"}`} mode={creating ? "create" : "edit"} initial={details} today={key(date)} error={error} busy={pending} onClose={() => { setCreating(false); setEditing(false); setError(""); }} onSubmit={submit} onCheck={checkReservationAvailability} errorFor={translatedError} /> : null}
    <Modal open={confirmCancel} title={t("cancelTitle")} subtitle={details?.guest} onClose={() => setConfirmCancel(false)} footer={<><button className="button-secondary" onClick={() => setConfirmCancel(false)}>{t("keep")}</button><button className="button-danger" disabled={pending} onClick={() => details && submit({ action: "status", id: details.id, status: "cancelled" })}>{pending ? t("saving") : t("actions.cancel")}</button></>}>
      <p className="cancel-confirm-copy">{t("cancelDescription")}</p><p className="detail-muted">{t("capacityRelease")}</p>
    </Modal>
    <Toast message={message} onDismiss={() => setMessage("")} />
  </>;
}

function ReservationEditor({ mode, initial, today, error, busy, onClose, onSubmit, onCheck, errorFor }: {
  mode: "create" | "edit"; initial: LiveReservation | null; today: string; error: string; busy: boolean; onClose: () => void;
  onSubmit: (input: Parameters<typeof manageReservation>[0]) => void;
  onCheck: typeof checkReservationAvailability; errorFor: (code: string) => string;
}) {
  const t = useTranslations("Reservations"); const c = useTranslations("Common");
  const [guest, setGuest] = useState(initial?.guest ?? ""); const [email, setEmail] = useState(initial?.email ?? ""); const [phone, setPhone] = useState(initial?.phone ?? ""); const [date, setDate] = useState(initial?.date ?? today); const [time, setTime] = useState(initial?.time ?? "10:00"); const [guests, setGuests] = useState(initial?.guests ?? 2); const [source, setSource] = useState<"phone" | "walk_in">(initial?.source === "walk_in" ? "walk_in" : "phone"); const [note, setNote] = useState(initial?.note ?? "");
  const [availability, setAvailability] = useState<Awaited<ReturnType<typeof checkReservationAvailability>> | null>(null); const [checking, setChecking] = useState(false); const [override, setOverride] = useState(false); const [reason, setReason] = useState(""); const [formError, setFormError] = useState("");
  const canOverride = availability?.ok && availability.canOverride && availability.reason !== "PAST";
  async function checkAvailability() {
    setChecking(true); setFormError(""); setOverride(false); setAvailability(await onCheck({ date, time, guests, source: mode === "create" ? source : initial?.source ?? "website", excludeId: mode === "edit" ? initial?.id : undefined })); setChecking(false);
  }
  const labelError = availability?.ok && !availability.available ? errorFor(availability.reason) : null;
  function save() {
    setFormError("");
    if (!guest.trim() && mode === "create") { setFormError(t("errors.nameRequired")); return; }
    if (mode === "create" && !email.trim() && !phone.trim()) { setFormError(t("errors.contactRequired")); return; }
    if (mode === "create" && email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setFormError(t("errors.emailInvalid")); return; }
    if (!availability?.ok || (!availability.available && !(canOverride && override && reason.trim().length >= 10))) { setFormError(labelError ?? t("errors.checkFirst")); return; }
    if (override && reason.trim().length < 10) { setFormError(t("errors.reasonRequired")); return; }
    onSubmit({ action: mode, id: initial?.id, guest: mode === "create" ? guest : undefined, email: mode === "create" ? email : undefined, phone: mode === "create" ? phone : undefined, date, time, guests, source: mode === "create" ? source : undefined, note, exceptionReason: override ? reason : undefined });
  }
  return <Modal open title={mode === "create" ? t("createTitle") : t("editTitle")} subtitle={mode === "create" ? t("createSubtitle") : initial?.reference} onClose={onClose} footer={<><button className="button-secondary" disabled={busy} onClick={onClose}>{c("cancel")}</button><button className="button-primary" disabled={busy || checking} onClick={save}>{busy ? <><LoaderCircle size={14} className="spin" />{t("saving")}</> : mode === "create" ? t("actions.create") : t("saveChanges")}</button></>}>
    <div className="form-grid">
      {mode === "create" ? <><div className="form-field is-full"><label htmlFor="staffGuest">{c("name")} *</label><input id="staffGuest" autoComplete="name" value={guest} onChange={(e) => setGuest(e.target.value)} maxLength={160} /></div><div className="form-field"><label htmlFor="staffEmail">{c("email")}</label><input id="staffEmail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={320} /></div><div className="form-field"><label htmlFor="staffPhone">{c("phone")}</label><input id="staffPhone" type="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} /></div><div className="form-field is-full"><label htmlFor="staffSource">{t("bookingSource")}</label><select id="staffSource" value={source} onChange={(e) => { setSource(e.target.value as "phone" | "walk_in"); setAvailability(null); }}><option value="phone">{c("telephone")}</option><option value="walk_in">{c("walkIn")}</option></select></div></> : null}
      <div className="form-field"><label htmlFor="staffDate">{c("date")}</label><input id="staffDate" type="date" value={date} onChange={(e) => { setDate(e.target.value); setAvailability(null); }} /></div><div className="form-field"><label htmlFor="staffTime">{c("time")}</label><input id="staffTime" type="time" value={time} onChange={(e) => { setTime(e.target.value); setAvailability(null); }} /></div><div className="form-field"><label htmlFor="staffGuests">{c("guests")}</label><select id="staffGuests" value={guests} onChange={(e) => { setGuests(Number(e.target.value)); setAvailability(null); }}>{Array.from({ length: 26 }, (_, i) => i + 1).map((number) => <option key={number} value={number}>{number}</option>)}</select></div><div className="form-field is-full"><label htmlFor="staffNote">{c("note")}</label><textarea id="staffNote" value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder={c("requestPlaceholder")} /></div>
    </div>
    <div className="availability-check"><button type="button" className="button-secondary" disabled={checking || busy} onClick={checkAvailability}>{checking ? <><LoaderCircle size={14} className="spin" />{t("checking")}</> : <><Clock3 size={14} />{t("checkAvailability")}</>}</button>{availability?.ok ? <p className={availability.available ? "availability-success" : "availability-error"} role="status">{availability.available ? t("availableFor", { duration: availability.duration }) : labelError}</p> : null}{availability && !availability.ok ? <p className="availability-error" role="alert">{errorFor(availability.code)}</p> : null}</div>
    {!availability?.ok || (availability.ok && !availability.available && canOverride) ? (canOverride ? <div className="exception-panel"><label className="exception-checkbox"><input type="checkbox" checked={override} onChange={(e) => setOverride(e.target.checked)} />{t("allowException")}</label><p>{t("exceptionDescription")}</p>{override ? <div className="form-field"><label htmlFor="exceptionReason">{t("exceptionReason")}</label><textarea id="exceptionReason" value={reason} minLength={10} maxLength={1000} onChange={(e) => setReason(e.target.value)} /></div> : null}</div> : null) : null}
    {error || formError ? <p className="form-error" role="alert">{error || formError}</p> : null}
  </Modal>;
}
