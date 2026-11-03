const BERLIN_TIME_ZONE = "Europe/Berlin";

export type ReservationConfirmation = {
  id: string;
  customerEmail: string;
  customerName: string;
  startsAt: string;
  guestCount: number;
  language: "de" | "en";
};

type ContactConfiguration = {
  from: string;
  email: string;
  phone: string;
  address: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'\"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '\"': "&quot;",
  })[character] ?? character);
}

function requiredEnvironment(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing email configuration: ${name}`);
  return value;
}

export function getEmailConfiguration(): ContactConfiguration {
  return {
    from: requiredEnvironment("RESEND_FROM_EMAIL"),
    email: requiredEnvironment("ALTSTADTLIEBE_CONTACT_EMAIL"),
    phone: requiredEnvironment("ALTSTADTLIEBE_CONTACT_PHONE"),
    address: requiredEnvironment("ALTSTADTLIEBE_CONTACT_ADDRESS"),
  };
}

function reservationDate(startsAt: string, language: "de" | "en") {
  return new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en-GB", {
    timeZone: BERLIN_TIME_ZONE,
    dateStyle: "full",
  }).format(new Date(startsAt));
}

function reservationTime(startsAt: string) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: BERLIN_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(startsAt));
}

export function buildReservationConfirmationEmail(
  reservation: ReservationConfirmation,
  contact: ContactConfiguration,
) {
  const isGerman = reservation.language === "de";
  const name = escapeHtml(reservation.customerName);
  const date = escapeHtml(reservationDate(reservation.startsAt, reservation.language));
  const time = escapeHtml(reservationTime(reservation.startsAt));
  const email = escapeHtml(contact.email);
  const phone = escapeHtml(contact.phone);
  const address = escapeHtml(contact.address);
  const guestLabel = isGerman ? "Gäste" : "guests";

  return {
    subject: isGerman ? "Deine Reservierung bei Altstadtliebe" : "Your Altstadtliebe reservation",
    text: isGerman
      ? `Hallo ${reservation.customerName},\n\nwir freuen uns auf dich bei Altstadtliebe.\n\nDatum: ${date}\nUhrzeit: ${time}\nGäste: ${reservation.guestCount}\n\nAltstadtliebe\n${contact.address}\n${contact.phone}\n${contact.email}`
      : `Hello ${reservation.customerName},\n\nwe look forward to welcoming you at Altstadtliebe.\n\nDate: ${date}\nTime: ${time}\nGuests: ${reservation.guestCount}\n\nAltstadtliebe\n${contact.address}\n${contact.phone}\n${contact.email}`,
    html: `<!doctype html>
<html lang="${isGerman ? "de" : "en"}">
  <body style="margin:0;background:#f4f0ea;color:#171311;font-family:Arial,Helvetica,sans-serif;">
    <div style="padding:32px 16px;">
      <div style="max-width:560px;margin:0 auto;background:#fffdfa;border:1px solid #e6dfd6;border-radius:18px;overflow:hidden;">
        <div style="padding:34px 32px 26px;text-align:center;border-bottom:1px solid #eee8e1;">
          <div style="font-size:22px;line-height:1;font-weight:700;letter-spacing:.18em;">ALTSTADTLIEBE</div>
          <div style="margin-top:9px;font-family:Georgia,serif;font-size:14px;font-style:italic;letter-spacing:.16em;">breakfast &amp; lunch</div>
        </div>
        <div style="padding:34px 32px 38px;">
          <p style="margin:0 0 12px;font-size:16px;line-height:1.5;">${isGerman ? `Hallo ${name},` : `Hello ${name},`}</p>
          <h1 style="margin:0 0 12px;font-size:28px;line-height:1.15;letter-spacing:-.02em;">${isGerman ? "Deine Reservierung ist bestätigt" : "Your reservation is confirmed"}</h1>
          <p style="margin:0 0 26px;color:#665b52;font-size:16px;line-height:1.55;">${isGerman ? "Wir freuen uns auf deinen Besuch." : "We look forward to welcoming you."}</p>
          <div style="padding:20px;background:#f5f1eb;border-radius:12px;">
            <div style="margin-bottom:13px;color:#766b61;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;">${isGerman ? "Deine Reservierung" : "Your reservation"}</div>
            <div style="font-size:17px;font-weight:700;line-height:1.6;">${date}</div>
            <div style="font-size:17px;line-height:1.6;">${time} · ${reservation.guestCount} ${guestLabel}</div>
          </div>
          <p style="margin:26px 0 0;color:#665b52;font-size:14px;line-height:1.6;">${isGerman ? "Bei Fragen erreichst du uns hier:" : "If you have any questions, contact us:"}<br>${address}<br>${phone}<br><a href="mailto:${email}" style="color:#3b2a20;">${email}</a></p>
        </div>
      </div>
    </div>
  </body>
</html>`,
  };
}
