"use client";

import { useEffect, type FormEvent, type ReactNode } from "react";
import { X } from "lucide-react";
import type { Reservation } from "@/lib/dashboard/mock-data";
import { useTranslations } from "next-intl";

export function Modal({ open, title, subtitle, children, onClose, footer, variant = "dialog" }: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  variant?: "dialog" | "drawer" | "confirm";
}) {
  const t = useTranslations("Common");
  useEffect(() => {
    if (!open) return;
    const handleEscape = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [open, onClose]);

  if (!open) return null;
  return <div className={`modal-backdrop modal-backdrop-${variant}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section className={`modal-card modal-card-${variant}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <header className="modal-head"><div><h2 className="modal-title" id="modal-title">{title}</h2>{subtitle ? <p className="modal-subtitle">{subtitle}</p> : null}</div><button type="button" className="icon-button" aria-label={t("close")} onClick={onClose}><X size={16} /></button></header>
      <div className="modal-body">{children}</div>
      {footer ? <footer className="modal-foot">{footer}</footer> : null}
    </section>
  </div>;
}

export type ReservationInput = Pick<Reservation, "guest" | "email" | "phone" | "date" | "time" | "guests" | "source" | "note">;

export function ReservationForm({ initial, onSubmit, onCancel, submitLabel, includeSource = true }: {
  initial?: Partial<ReservationInput>;
  onSubmit: (values: ReservationInput) => void;
  onCancel: () => void;
  submitLabel: string;
  includeSource?: boolean;
}) {
  const t = useTranslations("Common");
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    onSubmit({
      guest: String(form.get("guest") ?? "").trim(),
      email: String(form.get("email") ?? "").trim(),
      phone: String(form.get("phone") ?? "").trim(),
      date: String(form.get("date") ?? "2026-10-24"),
      time: String(form.get("time") ?? "10:00"),
      guests: Number(form.get("guests") ?? 2),
      source: String(form.get("source") ?? "Online") as Reservation["source"],
      note: String(form.get("note") ?? "").trim() || undefined,
    });
  }

  return <form onSubmit={handleSubmit}>
    <div className="form-grid">
      <div className="form-field is-full"><label htmlFor="guest">{t("name")}</label><input id="guest" name="guest" required onInvalid={(event) => event.currentTarget.setCustomValidity(t("validationName"))} onInput={(event) => event.currentTarget.setCustomValidity("")} defaultValue={initial?.guest ?? ""} placeholder={t("fullNamePlaceholder")} /></div>
      <div className="form-field"><label htmlFor="email">{t("email")}</label><input id="email" name="email" type="email" defaultValue={initial?.email ?? ""} placeholder={t("emailPlaceholder")} /></div>
      <div className="form-field"><label htmlFor="phone">{t("phone")}</label><input id="phone" name="phone" type="tel" defaultValue={initial?.phone ?? ""} placeholder="+49 …" /></div>
      <div className="form-field"><label htmlFor="date">{t("date")}</label><input id="date" name="date" type="date" required onInvalid={(event) => event.currentTarget.setCustomValidity(t("validationDate"))} onInput={(event) => event.currentTarget.setCustomValidity("")} defaultValue={initial?.date ?? "2026-10-24"} /></div>
      <div className="form-field"><label htmlFor="time">{t("time")}</label><input id="time" name="time" type="time" required onInvalid={(event) => event.currentTarget.setCustomValidity(t("validationTime"))} onInput={(event) => event.currentTarget.setCustomValidity("")} defaultValue={initial?.time ?? "10:00"} /></div>
      <div className="form-field"><label htmlFor="guests">{t("people")}</label><select id="guests" name="guests" defaultValue={initial?.guests ?? 2}>{Array.from({ length: 10 }, (_, index) => index + 1).map((number) => <option key={number} value={number}>{number} {number === 1 ? t("personOne") : t("people")}</option>)}</select></div>
      {includeSource ? <div className="form-field"><label htmlFor="source">{t("source")}</label><select id="source" name="source" defaultValue={initial?.source ?? "Telefon"}><option value="Online">{t("online")}</option><option value="Telefon">{t("telephone")}</option><option value="Walk-in">{t("walkIn")}</option></select></div> : <input type="hidden" name="source" value={initial?.source ?? "Online"} />}
      <div className="form-field is-full"><label htmlFor="note">{t("note")}</label><textarea id="note" name="note" defaultValue={initial?.note ?? ""} placeholder={t("requestPlaceholder")} /></div>
    </div>
    <div className="modal-foot" style={{ margin: "18px -22px -18px" }}><button type="button" className="button-secondary" onClick={onCancel}>{t("cancel")}</button><button type="submit" className="button-primary">{submitLabel}</button></div>
  </form>;
}

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(onDismiss, 2800);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);
  return message ? <div role="status" className="toast"><span aria-hidden="true">✓</span>{message}</div> : null;
}
