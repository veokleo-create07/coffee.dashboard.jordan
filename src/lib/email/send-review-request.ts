import "server-only";

type ReviewRequest = {
  reservationId: string;
  customerName: string;
  customerEmail: string;
  language: "de" | "en";
};

const reviewUrl = "https://search.google.com/local/writereview?placeid=ChIJR90hg8gJskcR6_QG_Nj49A4";
const resendEndpoint = "https://api.resend.com/emails";

const copy = {
  de: {
    subject: "Wie war dein Besuch bei Altstadtliebe?",
    title: "Wie war dein Besuch?",
    greeting: "Hallo {firstName},",
    body: "wir hoffen, du hattest eine schöne Zeit bei Altstadtliebe. Wenn du einen Moment hast, freuen wir uns sehr über deine ehrliche Bewertung bei Google.",
    button: "Google-Bewertung schreiben",
    closing: "Vielen Dank für deinen Besuch.",
    team: "Dein Altstadtliebe-Team",
  },
  en: {
    subject: "How was your visit to Altstadtliebe?",
    title: "How was your visit?",
    greeting: "Hi {firstName},",
    body: "we hope you enjoyed your time at Altstadtliebe. If you have a moment, we’d really appreciate your honest review on Google.",
    button: "Leave a Google review",
    closing: "Thank you for visiting us.",
    team: "Your team at Altstadtliebe",
  },
} as const;

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;",
  })[character] ?? character);
}

function firstName(fullName: string) {
  return fullName.trim().split(/\s+/u).find(Boolean) ?? fullName.trim();
}

function renderReviewRequest(reservation: ReviewRequest) {
  const text = copy[reservation.language];
  const greeting = text.greeting.replace("{firstName}", firstName(reservation.customerName));
  const logoUrl = "https://www.altstadtliebe.com/altstadtliebe-logo.png";
  const html = `<!doctype html><html lang="${reservation.language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${escapeHtml(text.subject)}</title></head><body bgcolor="#FFFFFF" style="margin:0;padding:0;background:#FFFFFF;color:#241814;-webkit-text-size-adjust:100%"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#FFFFFF"><tr><td align="center" style="padding:0 18px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px"><tr><td align="center" style="padding:42px 24px 28px"><img src="${logoUrl}" width="250" alt="Altstadtliebe breakfast &amp; lunch" style="display:block;width:250px;max-width:100%;height:auto;border:0"></td></tr><tr><td style="padding:24px 28px 0"><h1 style="margin:0;color:#241814;font-family:Arial,Helvetica,sans-serif;font-size:40px;line-height:1.08;letter-spacing:-1.4px">${escapeHtml(text.title)}</h1><p style="margin:30px 0 0;color:#241814;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:1.45;font-weight:700">${escapeHtml(greeting)}</p><p style="margin:9px 0 0;color:#241814;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.6">${escapeHtml(text.body)}</p></td></tr><tr><td style="padding:32px 28px 0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" bgcolor="#321A10" style="border-radius:10px"><a href="${reviewUrl}" style="display:block;padding:17px 24px;color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.25;font-weight:700;text-decoration:none">${escapeHtml(text.button)}</a></td></tr></table></td></tr><tr><td align="center" style="padding:38px 28px 46px"><div style="height:1px;background:#E8E1D8;font-size:1px;line-height:1px">&nbsp;</div><p style="margin:30px 0 0;color:#241814;font-family:Arial,Helvetica,sans-serif;font-size:17px;line-height:1.5;font-weight:700">${escapeHtml(text.closing)}</p><p style="margin:10px 0 0;color:#241814;font-family:Georgia,'Times New Roman',serif;font-size:17px;line-height:1.5;font-style:italic">${escapeHtml(text.team)}</p></td></tr></table></td></tr></table></body></html>`;
  const plainText = [text.title, "", greeting, text.body, "", `${text.button}: ${reviewUrl}`, "", text.closing, text.team].join("\n");
  return { subject: text.subject, html, text: plainText };
}

export async function sendReviewRequestEmail(reservation: ReviewRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from) throw new Error("Resend is not configured in the dashboard.");

  const email = renderReviewRequest(reservation);
  const response = await fetch(resendEndpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `reservation:${reservation.reservationId}:review-request`,
    },
    body: JSON.stringify({ from, to: [reservation.customerEmail], subject: email.subject, html: email.html, text: email.text }),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({})) as { message?: string; error?: string };
  if (!response.ok) throw new Error(payload.message ?? payload.error ?? `Resend returned ${response.status}`);
}
