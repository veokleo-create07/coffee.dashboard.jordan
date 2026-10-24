import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, MoreHorizontal } from "lucide-react";

export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-intro">
    <div><p className="eyebrow">{eyebrow}</p><h1 className="page-title">{title}</h1>{description ? <p className="page-description">{description}</p> : null}</div>
    {action ? <div className="page-intro-action">{action}</div> : null}
  </div>;
}

export function MetricCard({ label, value, detail, change, icon, tone = "clay" }: { label: string; value: string | number; detail: string; change?: string; icon: ReactNode; tone?: "clay" | "sage" | "gold" | "stone" }) {
  return <article className="metric-card">
    <div className="metric-top"><span className="metric-label">{label}</span><span className={`metric-icon tone-${tone}`}>{icon}</span></div>
    <div className="metric-value-row"><span className="metric-value">{value}</span>{change ? <span className="metric-change"><ArrowUpRight size={13} />{change}</span> : null}</div>
    <p className="metric-detail">{detail}</p>
  </article>;
}

export function PanelHeading({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="panel-heading"><div><h2>{title}</h2>{detail ? <p>{detail}</p> : null}</div>{action}</div>;
}

export function SectionLink({ children, href }: { children: ReactNode; href: string }) {
  return <Link className="text-link" href={href}>{children}<ArrowDownRight size={14} /></Link>;
}

export function MiniIconButton({ label }: { label: string }) {
  return <button type="button" aria-label={label} className="icon-button"><MoreHorizontal size={18} /></button>;
}
