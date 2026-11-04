import type { ReactNode } from "react";
import { useLocale } from "next-intl";

export function PageIntro({ eyebrow, title, description, action }: { eyebrow: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-intro">
    <div>{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}<h1 className="page-title">{title}</h1>{description ? <p className="page-description">{description}</p> : null}</div>
    {action ? <div className="page-intro-action">{action}</div> : null}
  </div>;
}

export function MetricCard({ label, value, detail, icon, tone = "clay" }: { label: string; value: string | number; detail: string; icon: ReactNode; tone?: "clay" | "sage" | "gold" | "stone" }) {
  const locale = useLocale();
  const formattedValue = typeof value === "number" ? new Intl.NumberFormat(locale).format(value) : value;
  return <article className="metric-card">
    <span className={`metric-icon tone-${tone}`}>{icon}</span><div className="metric-copy"><div className="metric-value-row"><span className="metric-value">{formattedValue}</span></div><span className="metric-label">{label}</span><p className="metric-detail">{detail}</p></div>
  </article>;
}

export function PanelHeading({ title, detail, action }: { title: string; detail?: string; action?: ReactNode }) {
  return <div className="panel-heading"><div><h2>{title}</h2>{detail ? <p>{detail}</p> : null}</div>{action}</div>;
}
