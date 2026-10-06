import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Public trends",
  robots: { index: true, follow: true },
  openGraph: { title: "MeeronBi public trends", description: "Aggregate antenatal care trends", type: "website" },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
