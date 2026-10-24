import type { Metadata } from "next";
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Altstadtliebe · Team", template: "%s · Altstadtliebe" },
  description: "Der interne Arbeitsbereich für das Team von Altstadtliebe.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body>{children}</body></html>;
}
