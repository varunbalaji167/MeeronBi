import type { Metadata } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import Providers from "./providers";
import { appUrl } from "@/config/env";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600"],
  style: ["normal", "italic"],
});
const body = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: { default: "MeeronBi — Antenatal Care Data Analytics", template: "%s · MeeronBi" },
  description: "Antenatal care data collection and analytics platform",
  // Health-records app: noindex by default; only the marketing and public-trends pages opt back in.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body className="min-h-screen bg-paper font-sans text-ink">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
