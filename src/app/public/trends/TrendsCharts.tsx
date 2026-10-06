"use client";

import { TrendingUp, PieChart as PieChartIcon, BarChart3 } from "lucide-react";
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

interface TrendsChartsProps {
  deliveriesByMode: { mode: string | null; count: number }[];
  robsonGroups: { group: number | null; count: number }[];
  registrationsByMonth: { month: string; count: number }[];
}

export default function TrendsCharts({ deliveriesByMode, robsonGroups, registrationsByMonth }: TrendsChartsProps) {
  return (
    <>
      <div className="animate-rise-in panel sm:col-span-3" style={{ animationDelay: "180ms" }}>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <TrendingUp className="h-3.5 w-3.5" />
          </span>
          Registrations Over Time
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={registrationsByMonth}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
            <XAxis dataKey="month" {...CHART_AXIS_PROPS} />
            <YAxis allowDecimals={false} {...CHART_AXIS_PROPS} />
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
            <Line type="monotone" dataKey="count" stroke="#0E6B5C" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="animate-rise-in panel sm:col-span-1" style={{ animationDelay: "240ms" }}>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold-50 text-gold-600">
            <PieChartIcon className="h-3.5 w-3.5" />
          </span>
          Delivery Mode
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <PieChart>
            <Pie
              data={deliveriesByMode}
              dataKey="count"
              nameKey="mode"
              outerRadius={80}
              label={(d) => `${d.mode}: ${d.count}`}
            >
              {deliveriesByMode.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <div className="animate-rise-in panel sm:col-span-2" style={{ animationDelay: "300ms" }}>
        <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <BarChart3 className="h-3.5 w-3.5" />
          </span>
          Robson Ten-Group Classification
        </h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={robsonGroups}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
            <XAxis dataKey="group" tickFormatter={(g) => `Grp ${g}`} {...CHART_AXIS_PROPS} />
            <YAxis allowDecimals={false} {...CHART_AXIS_PROPS} />
            <Tooltip labelFormatter={(g) => `Robson Group ${g}`} contentStyle={CHART_TOOLTIP_STYLE} />
            <Bar dataKey="count" fill="#0E6B5C" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
