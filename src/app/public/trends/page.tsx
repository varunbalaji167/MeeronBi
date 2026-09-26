"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Skeleton from "@/components/ui/Skeleton";
import {
  ArrowLeft,
  Users,
  Baby,
  Activity,
  TrendingUp,
  PieChart as PieChartIcon,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";
import { CHART_COLORS, CHART_GRID_STROKE, CHART_AXIS_PROPS, CHART_TOOLTIP_STYLE } from "@/components/analytics/chartTheme";

interface Trends {
  totalPatients: number;
  deliveriesByMode: { mode: string; count: number }[];
  robsonGroups: { group: number; count: number }[];
  avgBabyWeightKg: number | null;
  registrationsByMonth: { month: string; count: number }[];
}

export default function PublicTrendsPage() {
  const [trends, setTrends] = useState<Trends | null>(null);
  const [loading, setLoading] = useState(true);
  const { role, isLoading: authLoading } = useAuth();

  const homeHref =
    role === "ADMIN" || role === "SUPER_ADMIN"
      ? "/admin"
      : role === "PATIENT"
        ? "/patient"
        : role === "RESEARCHER"
          ? "/researcher"
          : "/";
  const homeLabel = authLoading ? "Home" : role ? "Dashboard" : "Home";

  useEffect(() => {
    fetch("/api/public/trends")
      .then((r) => r.json())
      .then(setTrends)
      .finally(() => setLoading(false));
  }, []);

  const totalDeliveries = trends?.deliveriesByMode.reduce((sum, d) => sum + d.count, 0) ?? 0;

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <div>
            <Link href="/" className="text-xs font-medium uppercase tracking-wider text-brand-600 hover:text-brand-700">
              MeeronBi
            </Link>
            <h1 className="font-display text-2xl italic text-ink">Public Research Trends</h1>
          </div>
          <Link href={homeHref} className="tab-link flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> {homeLabel}
          </Link>
        </div>
      </header>

      <div className="relative">
        <div
          className="pointer-events-none absolute -top-10 right-[-8%] h-64 w-64 rounded-full bg-brand-200/25 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative mx-auto max-w-5xl px-6 py-10">
          <p className="mb-8 max-w-2xl text-sm leading-relaxed text-ink-soft">
            Aggregated, anonymized statistics from the antenatal care dataset. No individual
            patient data is shown here — no login required.
          </p>

          {loading && (
            <div className="grid gap-5 sm:grid-cols-3">
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-72 w-full sm:col-span-3" />
              <Skeleton className="h-72 w-full sm:col-span-1" />
              <Skeleton className="h-72 w-full sm:col-span-2" />
            </div>
          )}

          {trends && (
            <div className="grid gap-5 sm:grid-cols-3">
              <div
                className="animate-rise-in panel flex items-center gap-4 border-l-2 border-brand-300"
                style={{ animationDelay: "0ms" }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <Users className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Registered Patients
                  </h2>
                  <p className="font-display text-3xl italic text-brand-700">{trends.totalPatients}</p>
                </div>
              </div>

              <div
                className="animate-rise-in panel flex items-center gap-4 border-l-2 border-gold-200"
                style={{ animationDelay: "60ms" }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-600">
                  <Activity className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Recorded Deliveries
                  </h2>
                  <p className="font-display text-3xl italic text-brand-700">{totalDeliveries}</p>
                </div>
              </div>

              <div
                className="animate-rise-in panel flex items-center gap-4 border-l-2 border-brand-300"
                style={{ animationDelay: "120ms" }}
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                  <Baby className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Avg. Baby Weight
                  </h2>
                  <p className="font-display text-3xl italic text-brand-700">
                    {trends.avgBabyWeightKg ? `${trends.avgBabyWeightKg.toFixed(2)} kg` : "—"}
                  </p>
                </div>
              </div>

              <div
                className="animate-rise-in panel sm:col-span-3"
                style={{ animationDelay: "180ms" }}
              >
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <TrendingUp className="h-3.5 w-3.5" />
                  </span>
                  Registrations Over Time
                </h2>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={trends.registrationsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                    <XAxis dataKey="month" {...CHART_AXIS_PROPS} />
                    <YAxis allowDecimals={false} {...CHART_AXIS_PROPS} />
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                    <Line type="monotone" dataKey="count" stroke="#0E6B5C" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div
                className="animate-rise-in panel sm:col-span-1"
                style={{ animationDelay: "240ms" }}
              >
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-50 text-gold-600">
                    <PieChartIcon className="h-3.5 w-3.5" />
                  </span>
                  Delivery Mode
                </h2>
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={trends.deliveriesByMode}
                      dataKey="count"
                      nameKey="mode"
                      outerRadius={80}
                      label={(d) => `${d.mode}: ${d.count}`}
                    >
                      {trends.deliveriesByMode.map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div
                className="animate-rise-in panel sm:col-span-2"
                style={{ animationDelay: "300ms" }}
              >
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                    <BarChart3 className="h-3.5 w-3.5" />
                  </span>
                  Robson Ten-Group Classification
                </h2>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={trends.robsonGroups}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
                    <XAxis dataKey="group" tickFormatter={(g) => `Grp ${g}`} {...CHART_AXIS_PROPS} />
                    <YAxis allowDecimals={false} {...CHART_AXIS_PROPS} />
                    <Tooltip
                      labelFormatter={(g) => `Robson Group ${g}`}
                      contentStyle={CHART_TOOLTIP_STYLE}
                    />
                    <Bar dataKey="count" fill="#0E6B5C" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
