"use client";

import { useMemo, useState } from "react";
import { Coffee, Mail, Phone, Search, Star, UsersRound } from "lucide-react";
import { PageIntro, PanelHeading } from "@/components/dashboard/primitives";
import { mockGuests, type Guest } from "@/lib/dashboard/mock-data";

function initials(name: string) { return name.split(/[ &]/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }
const history = [
  { date: "24. Okt. 2026", time: "09:00", guests: 2 },
  { date: "11. Okt. 2026", time: "10:30", guests: 3 },
  { date: "27. Sep. 2026", time: "11:00", guests: 2 },
];

export default function GuestsPage() {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Guest>(mockGuests[0]);
  const guests = useMemo(() => mockGuests.filter((guest) => `${guest.name} ${guest.email} ${guest.phone}`.toLowerCase().includes(query.toLowerCase().trim())), [query]);

  return <>
    <PageIntro eyebrow="Menschen, die wiederkommen" title="Gäste" description="Ein kleines Gedächtnis für gute Begegnungen." />
    <div className="guests-toolbar"><label className="search-field"><Search size={14} /><input aria-label="Gäste suchen" placeholder="Name, E-Mail oder Telefon suchen" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span className="result-count">{guests.length} Gäste · Mock-Verzeichnis</span></div>
    <section className="guests-layout">
      <article className="panel guest-list-panel">
        <PanelHeading title="Gästeverzeichnis" detail="Zuletzt aktiv zuerst" action={<UsersRound size={15} color="#9a8c7b" />} />
        <div className="table-wrap"><table className="data-table guest-directory-table"><thead><tr><th>Gast</th><th>Besuche</th><th>Zuletzt hier</th><th>Lieblingsbestellung</th></tr></thead><tbody>
          {guests.map((guest) => <tr key={guest.email} onClick={() => setSelected(guest)} className={`guest-table-row${guest.email === selected.email ? " is-selected" : ""}`}>
            <td><span className="guest-directory-name"><span className="avatar">{initials(guest.name)}</span><span><span className="guest-primary">{guest.name}</span><span className="guest-secondary">{guest.email}</span></span></span></td>
            <td>{guest.visits} <span className="source-tag">Besuche</span></td><td>{guest.lastVisit}</td><td><span className="favorite-cell"><Coffee size={12} />{guest.favorite}</span></td>
          </tr>)}
        </tbody></table>{!guests.length ? <div className="empty-search">Keine Gäste gefunden.</div> : null}</div>
      </article>

      <aside className="panel guest-profile" aria-live="polite">
        <div className="profile-header"><span className="avatar-large">{initials(selected.name)}</span><div><h2 className="profile-name">{selected.name}</h2><p className="profile-subtitle">Gast seit Frühjahr 2025</p></div><span className="guest-star"><Star size={15} /></span></div>
        <div className="profile-stats"><div className="profile-stat"><strong>{selected.visits}</strong><span>Besuche insgesamt</span></div><div className="profile-stat"><strong>{selected.lastVisit === "Heute" ? "Heute" : selected.lastVisit}</strong><span>Letzter Besuch</span></div></div>
        <section className="profile-section"><h3 className="profile-section-title">Kontakt</h3><a className="contact-line" href={`mailto:${selected.email}`}><Mail size={14} />{selected.email}</a><a className="contact-line" href={`tel:${selected.phone.replaceAll(" ", "")}`}><Phone size={14} />{selected.phone}</a></section>
        <section className="profile-section"><h3 className="profile-section-title">Besondere Wünsche</h3><div className="profile-note">{selected.note}</div><div className="favorite-note"><Coffee size={13} /> Meistbestellt: <strong>{selected.favorite}</strong></div></section>
        <section className="profile-section"><h3 className="profile-section-title">Besuchshistorie</h3><div className="visit-history">{history.map((visit) => <div className="visit-item" key={`${selected.email}-${visit.date}`}><div><div className="visit-date">{visit.date}</div><div className="visit-time">{visit.time} Uhr · Tisch 04</div></div><span className="visit-guests">{visit.guests} Pers.</span></div>)}</div><p className="history-caption">Beispielhafte Besuche · keine echten Gästedaten</p></section>
      </aside>
    </section>
    <div className="mock-data-notice">Alle angezeigten Gästedaten sind fiktiv und dienen ausschließlich der UI-Vorschau.</div>
  </>;
}
