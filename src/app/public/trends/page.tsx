"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import Skeleton from "@/components/ui/Skeleton";
import { ArrowLeft, Users, Baby, TrendingUp, PieChart as PieChartIcon, BarChart3 } from "lucide-react";
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

interface Trends {
  totalPatients: number;
  deliveriesByMode: { mode: string; count: number }[];
  robsonGroups: { group: number; count: number }[];
  avgBabyWeightKg: number | null;
  registrationsByMonth: { month: string; count: number }[];
}

const CHART_COLORS = ["#0E6B5C", "#B8862E", "#79B7A4", "#A3423D", "#3D8E77", "#EBC97A"];

export default function PublicTrendsPage() {
  const [trends, setTrends] = useState<Trends | null>(null);
  const [loading, setLoading] = useState(true);
  const { role, isLoading: authLoading } = useAuth();

  const homeHref = role === "ADMIN" ? "/admin" : role === "PATIENT" ? "/patient" : "/";
  const homeLabel = authLoading ? "Home" : role ? "Dashboard" : "Home";

  useEffect(() => {
    fetch("/api/public/trends")
      .then((r) => r.json())
      .then(setTrends)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-brand-600">MeeronBi</p>
            <h1 className="font-display text-2xl italic text-ink">Public Research Trends</h1>
          </div>
          <Link href={homeHref} className="tab-link flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" /> {homeLabel}
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <p className="mb-8 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Aggregated, anonymized statistics from the antenatal care dataset. No individual
          patient data is shown here — no login required.
        </p>

        {loading && (
          <div className="grid gap-5 sm:grid-cols-2">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-72 w-full sm:col-span-2" />
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        )}

        {trends && (
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="panel border-l-2 border-brand-300">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                <Users className="h-3.5 w-3.5" /> Total Registered Patients
              </h2>
              <p className="mt-2 font-display text-4xl italic text-brand-700">
                {trends.totalPatients}
              </p>
            </div>

            <div className="panel border-l-2 border-gold-200">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                <Baby className="h-3.5 w-3.5" /> Average Baby Weight
              </h2>
              <p className="mt-2 font-display text-4xl italic text-brand-700">
                {trends.avgBabyWeightKg ? `${trends.avgBabyWeightKg.toFixed(2)} kg` : "—"}
              </p>
            </div>

            <div className="panel sm:col-span-2">
              <h2 className="mb-4 flex items-center gap-1.5 border-l-2 border-brand-200 pl-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                <TrendingUp className="h-3.5 w-3.5" /> Registrations Over Time
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={trends.registrationsByMonth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E1E0D5" />
                  <XAxis dataKey="month" fontSize={12} stroke="#6B7268" />
                  <YAxis allowDecimals={false} fontSize={12} stroke="#6B7268" />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#E1E0D5", fontSize: 13 }} />
                  <Line type="monotone" dataKey="count" stroke="#0E6B5C" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div className="panel">
              <h2 className="mb-4 flex items-center gap-1.5 border-l-2 border-brand-200 pl-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                <PieChartIcon className="h-3.5 w-3.5" /> Delivery Mode
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={trends.deliveriesByMode}
                    dataKey="count"
                    nameKey="mode"
                    outerRadius={90}
                    label={(d) => `${d.mode}: ${d.count}`}
                  >
                    {trends.deliveriesByMode.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#E1E0D5", fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <div className="panel">
              <h2 className="mb-4 flex items-center gap-1.5 border-l-2 border-brand-200 pl-3 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                <BarChart3 className="h-3.5 w-3.5" /> Robson Ten-Group Classification
              </h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={trends.robsonGroups}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E1E0D5" />
                  <XAxis dataKey="group" tickFormatter={(g) => `Grp ${g}`} fontSize={12} stroke="#6B7268" />
                  <YAxis allowDecimals={false} fontSize={12} stroke="#6B7268" />
                  <Tooltip
                    labelFormatter={(g) => `Robson Group ${g}`}
                    contentStyle={{ borderRadius: 8, borderColor: "#E1E0D5", fontSize: 13 }}
                  />
                  <Bar dataKey="count" fill="#0E6B5C" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
