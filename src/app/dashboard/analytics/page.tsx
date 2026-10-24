"use client";

import { useMemo, useState } from "react";
import { BarChart3, CalendarDays, Clock3, UsersRound } from "lucide-react";
import { MetricCard, PageIntro, PanelHeading } from "@/components/dashboard/primitives";

type Period = "Oktober 2026" | "September 2026" | "August 2026";
const datasets: Record<Period, { reservations: number; guests: number; average: string; noShows: number; rate: string; times: number[]; sources: [string, number][] }> = {
  "Oktober 2026": { reservations: 428, guests: 912, average: "2,1", noShows: 9, rate: "2,1 %", times: [18, 31, 45, 56, 62, 49, 34, 22], sources: [["Online", 68], ["Telefon", 23], ["Walk-in", 9]] },
  "September 2026": { reservations: 392, guests: 835, average: "2,1", noShows: 11, rate: "2,8 %", times: [16, 28, 41, 53, 58, 46, 31, 20], sources: [["Online", 64], ["Telefon", 27], ["Walk-in", 9]] },
  "August 2026": { reservations: 361, guests: 784, average: "2,2", noShows: 8, rate: "2,2 %", times: [14, 25, 38, 49, 56, 45, 32, 18], sources: [["Online", 61], ["Telefon", 29], ["Walk-in", 10]] },
};
const hours = ["09", "10", "11", "12", "13", "14", "15", "16"];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>("Oktober 2026");
  const data = datasets[period];
  const peak = useMemo(() => hours[data.times.indexOf(Math.max(...data.times))], [data]);
  return <>
    <PageIntro eyebrow="Ein Gefühl für den Rhythmus" title="Analysen" description="Monatliche Einblicke in Besuche und Buchungen." action={<label className="period-select-wrap"><CalendarDays size={14} /><select className="select-control period-select" aria-label="Monat wählen" value={period} onChange={(event) => setPeriod(event.target.value as Period)}>{Object.keys(datasets).map((month) => <option key={month}>{month}</option>)}</select></label>} />
    <section className="metric-grid analytics-metrics" aria-label={`Kennzahlen ${period}`}>
      <MetricCard label="Reservierungen" value={data.reservations} detail={`im ${period}`} change="+9,4 % zum Vormonat" icon={<CalendarDays size={15} />} />
      <MetricCard label="Gäste insgesamt" value={data.guests.toLocaleString("de-DE")} detail="über alle Buchungen" change="+7,8 % zum Vormonat" icon={<UsersRound size={15} />} tone="sage" />
      <MetricCard label="Ø Gäste pro Buchung" value={data.average} detail="Personen" icon={<BarChart3 size={15} />} tone="gold" />
      <MetricCard label="No-show-Quote" value={data.rate} detail={`${data.noShows} Reservierungen`} icon={<Clock3 size={15} />} tone="stone" />
    </section>

    <section className="analytics-grid">
      <article className="panel chart-panel">
        <PanelHeading title="Beliebte Buchungszeiten" detail="Reservierungen nach Startzeit · Mock-Daten" />
        <div className="chart-body"><div className="chart-axis-note"><span>mehr Buchungen</span><span>Peak · {peak}:00 Uhr</span></div><div className="bar-chart" role="img" aria-label={`Buchungszeiten, beliebteste Stunde ${peak} Uhr`}>
          {data.times.map((value, index) => <div className="bar-group" key={hours[index]}><span className="bar-value">{value}</span><div className={`bar${index === data.times.indexOf(Math.max(...data.times)) ? " is-highlight" : ""}`} style={{ height: `${(value / 65) * 100}%` }} /><span className="bar-label">{hours[index]}</span></div>)}
        </div><div className="chart-legend"><span><i className="legend-dot" />Reservierungen</span><span><i className="legend-dot dark" />Beliebteste Stunde</span></div></div>
      </article>

      <article className="panel">
        <PanelHeading title="Buchungsquellen" detail="Anteil an allen Reservierungen" />
        <div className="source-list">{data.sources.map(([name, value]) => <div className="source-item" key={name}><span>{name}</span><div className="source-track"><div className="source-fill" style={{ width: `${value}%` }} /></div><span className="source-value">{value} %</span></div>)}<p className="source-caption">Online-Buchungen machen den größten Anteil aus. Telefon und spontane Besuche ergänzen den Tagesmix.</p></div>
      </article>

      <article className="panel noshow-panel">
        <PanelHeading title="Nicht erschienen" detail="Buchungen ohne Ankunft" />
        <div className="noshow-grid"><div className="noshow-stat"><strong>{data.noShows}</strong><span>No-shows im Monat</span></div><div className="noshow-stat"><strong>{data.rate}</strong><span>Anteil an Reservierungen</span></div></div>
        <p className="noshow-caption">Die Zahlen dienen nur als Beispiel. Es gibt noch keine Verbindung zu echten Reservierungen.</p>
      </article>

      <aside className="analytics-note"><span className="analytics-note-mark">i</span><p><strong>Ein ruhiger Hinweis</strong><br />Diese Einblicke basieren auf realistisch angelegten Mock-Daten. Sie ändern sich beim Wechsel des Monats, werden aber nicht gespeichert.</p></aside>
    </section>
  </>;
}
