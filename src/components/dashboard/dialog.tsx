"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { useTranslations } from "next-intl";

export function Modal({ open, title, subtitle, children, onClose, footer, headerAction, variant = "dialog" }: {
  open: boolean;
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  headerAction?: ReactNode;
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
      <header className="modal-head"><div><h2 className="modal-title" id="modal-title">{title}</h2><div className="modal-subtitle-row">{subtitle ? <p className="modal-subtitle">{subtitle}</p> : null}{headerAction}</div></div><div className="modal-head-actions"><button type="button" className="icon-button" aria-label={t("close")} onClick={onClose}><X size={16} /></button></div></header>
      <div className="modal-body">{children}</div>
      {footer ? <footer className="modal-foot">{footer}</footer> : null}
    </section>
  </div>;
}

export function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(onDismiss, 2800);
    return () => window.clearTimeout(timeout);
  }, [message, onDismiss]);
  return message ? <div role="status" className="toast"><span aria-hidden="true">✓</span>{message}</div> : null;
}
