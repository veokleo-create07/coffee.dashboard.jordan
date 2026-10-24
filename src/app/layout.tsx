import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { cookies } from "next/headers";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Altstadtliebe · Team", template: "%s · Altstadtliebe" },
  description: "Der interne Arbeitsbereich für das Team von Altstadtliebe.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = (await cookies()).get("AL_LOCALE")?.value === "en" ? "en" : "de";
  return <html lang={locale}><body><NextIntlClientProvider locale={locale} messages={locale === "en" ? en : de}>{children}</NextIntlClientProvider></body></html>;
}
