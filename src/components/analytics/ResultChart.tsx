"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
  Legend,
} from "recharts";
import { BarChart3, PieChart as PieChartIcon, Trophy, CircleDot, ArrowLeftRight, Rows3 } from "lucide-react";
import { AnalyticsFieldMeta, AnalyticsResult, CentralTendencies, CrossTabCell, ScatterPoint } from "@/domain/analytics/types";
import { CHART_COLORS, CHART_GRID_STROKE, CHART_AXIS_PROPS, CHART_AXIS_STROKE, CHART_TOOLTIP_STYLE, SUPPRESSED_COLOR } from "./chartTheme";
import CentralTendenciesPanel from "./CentralTendenciesPanel";

function colorFor(index: number, suppressed?: boolean): string {
  if (suppressed) return SUPPRESSED_COLOR;
  return CHART_COLORS[index % CHART_COLORS.length];
}

function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

/** Not enough data (below the disclosure floor) is indistinguishable from truly no data — treat both as "not enough data". */
function NotEnoughDataNotice() {
  return <div className="panel text-sm text-ink-soft">Not enough patients have data for this comparison yet to show a result.</div>;
}

/** Ratio field x Ratio filter: scatter plot. Default (per spec): filter on X, field on Y — flippable client-side. */
function RatioScatterSection({ field, filter, points }: { field: AnalyticsFieldMeta; filter: AnalyticsFieldMeta; points: ScatterPoint[] }) {
  const [swapped, setSwapped] = useState(false);
  if (points.length === 0) return <NotEnoughDataNotice />;

  // ScatterPoint.x is always the analyzed field's value, .y always the filter's — the toggle just
  // picks which one the chart currently reads for its X axis.
  const xField = swapped ? field : filter;
  const yField = swapped ? filter : field;
  const data = points.map((p) => ({ x: swapped ? p.x : p.y, y: swapped ? p.y : p.x }));

  return (
    <div className="panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          <CircleDot className="h-3.5 w-3.5 text-brand-500" /> {field.label} vs. {filter.label}
        </h3>
        <button
          type="button"
          onClick={() => setSwapped((s) => !s)}
          className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-ink-soft transition-colors hover:border-brand-200 hover:bg-brand-50 hover:text-brand-700"
        >
          <ArrowLeftRight className="h-3 w-3" /> Swap axes
        </button>
      </div>
      <ResponsiveContainer width="100%" height={340}>
        <ScatterChart margin={{ left: 8, right: 16, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
          <XAxis
            type="number"
            dataKey="x"
            {...CHART_AXIS_PROPS}
            label={{ value: xField.label, position: "insideBottom", offset: -12, fontSize: 12, fill: CHART_AXIS_STROKE }}
          />
          <YAxis
            type="number"
            dataKey="y"
            {...CHART_AXIS_PROPS}
            label={{ value: yField.label, angle: -90, position: "insideLeft", fontSize: 12, fill: CHART_AXIS_STROKE }}
          />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            contentStyle={CHART_TOOLTIP_STYLE}
            formatter={(value: number, name: string) => [value, name === "x" ? xField.label : yField.label]}
          />
          <Scatter data={data} fill={CHART_COLORS[0]} />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

const STAT_OPTIONS: { key: "average" | "count"; label: string }[] = [
  { key: "average", label: "Average" },
  { key: "count", label: "Count" },
];

/** Ratio field x Categorical filter: a chosen stat per group, plus the full central-tendencies table underneath. */
function RatioByCategorySection({
  field,
  filter,
  groups,
}: {
  field: AnalyticsFieldMeta;
  filter: AnalyticsFieldMeta;
  groups: { value: string; stats: CentralTendencies }[];
}) {
  const [stat, setStat] = useState<"average" | "count">("average");
  if (groups.length === 0) return <NotEnoughDataNotice />;

  const data = groups.map((g) => ({ value: g.value, ...g.stats }));

  return (
    <div className="space-y-4">
      <div className="panel">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-soft">
            <BarChart3 className="h-3.5 w-3.5 text-brand-500" /> {field.label} by {filter.label}
          </h3>
          <div className="flex items-center gap-1 rounded-full border border-line p-0.5">
            {STAT_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setStat(opt.key)}
                className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  stat === opt.key ? "bg-brand-50 text-brand-700" : "text-ink-soft hover:text-brand-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ left: 4, right: 12 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
            <XAxis dataKey="value" {...CHART_AXIS_PROPS} interval={0} angle={-20} textAnchor="end" height={60} />
            <YAxis allowDecimals={stat === "count"} {...CHART_AXIS_PROPS} unit={stat === "average" && field.unit ? ` ${field.unit}` : undefined} />
            <Tooltip
              contentStyle={CHART_TOOLTIP_STYLE}
              formatter={(value: number) => [stat === "average" ? formatNumber(value) : value, STAT_OPTIONS.find((o) => o.key === stat)!.label]}
            />
            <Bar dataKey={stat} radius={[4, 4, 0, 0]}>
              {data.map((d, i) => (
                <Cell key={d.value} fill={colorFor(i)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel overflow-x-auto">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-soft">
          <Rows3 className="h-3.5 w-3.5 text-brand-500" /> Group statistics
        </h3>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-faint">
              <th className="py-2 pr-4">{filter.label}</th>
              <th className="py-2 pr-4">Count</th>
              <th className="py-2 pr-4">Average</th>
              <th className="py-2 pr-4">Min</th>
              <th className="py-2 pr-4">Max</th>
              <th className="py-2 pr-4">Mode</th>
              <th className="py-2">Std. Deviation</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.value} className="border-b border-line/60 last:border-0">
                <td className="py-2 pr-4 font-medium text-ink">{g.value}</td>
                <td className="py-2 pr-4">{g.stats.count}</td>
                <td className="py-2 pr-4">{formatNumber(g.stats.average)}</td>
                <td className="py-2 pr-4">{formatNumber(g.stats.min)}</td>
                <td className="py-2 pr-4">{formatNumber(g.stats.max)}</td>
                <td className="py-2 pr-4">{g.stats.mode === null ? "—" : formatNumber(g.stats.mode)}</td>
                <td className="py-2">{formatNumber(g.stats.standardDeviation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Grouped bar of counts, filter categories on X. A suppressed cell renders as a zero-height,
// greyed-out bar rather than disappearing, so "there was data, too little to show" stays visible.
function CategoryByCategorySection({ field, filter, cells }: { field: AnalyticsFieldMeta; filter: AnalyticsFieldMeta; cells: CrossTabCell[] }) {
  if (cells.length === 0) return <NotEnoughDataNotice />;

  const filterValues: string[] = [];
  const fieldValues: string[] = [];
  for (const cell of cells) {
    if (!filterValues.includes(cell.filterValue)) filterValues.push(cell.filterValue);
    if (!fieldValues.includes(cell.value)) fieldValues.push(cell.value);
  }
  const cellByKey = new Map(cells.map((c) => [`${c.filterValue}\u0000${c.value}`, c]));

  const data = filterValues.map((filterValue) => {
    const row: Record<string, string | number | boolean> = { filterValue };
    for (const value of fieldValues) {
      const cell = cellByKey.get(`${filterValue}\u0000${value}`);
      row[value] = cell?.count ?? 0;
      row[`${value}__suppressed`] = cell?.suppressed ?? false;
    }
    return row;
  });

  const hasSuppressed = cells.some((c) => c.suppressed);

  return (
    <div className="panel">
      <h3 className="mb-4 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-soft">
        <BarChart3 className="h-3.5 w-3.5 text-brand-500" /> {field.label} by {filter.label}
      </h3>
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={data} margin={{ left: 4, right: 12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
          <XAxis dataKey="filterValue" {...CHART_AXIS_PROPS} interval={0} angle={-20} textAnchor="end" height={60} />
          <YAxis allowDecimals={false} {...CHART_AXIS_PROPS} />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          {fieldValues.map((value, i) => (
            <Bar key={value} dataKey={value} name={value} fill={colorFor(i)} radius={[4, 4, 0, 0]}>
              {data.map((row, j) => (
                <Cell key={j} fill={row[`${value}__suppressed`] ? SUPPRESSED_COLOR : colorFor(i)} />
              ))}
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
      {hasSuppressed && (
        <p className="mt-3 text-xs text-ink-faint">
          Some small groups have been hidden (shown as zero) to protect patient privacy.
        </p>
      )}
    </div>
  );
}

export default function ResultChart({
  field,
  filter,
  result,
}: {
  field: AnalyticsFieldMeta;
  filter?: AnalyticsFieldMeta | null;
  result: AnalyticsResult;
}) {
  switch (result.kind) {
    case "ratioSummary": {
      if (result.stats.count === 0) return <NotEnoughDataNotice />;

      const hasSuppressed = result.buckets.some((b) => b.suppressed);
      const topBucket = result.buckets.reduce<(typeof result.buckets)[number] | null>(
        (best, b) => (!b.suppressed && (!best || b.count > best.count) ? b : best),
        null
      );
      return (
        <div className="space-y-5">
          <CentralTendenciesPanel stats={result.stats} unit={field.unit} />
          <div className="panel">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-soft">
                <BarChart3 className="h-3.5 w-3.5 text-brand-500" /> {field.label} distribution
              </h3>
              {topBucket && topBucket.count > 0 && (
                <span className="flex items-center gap-1 rounded-full bg-gold-50 px-2.5 py-1 text-xs font-medium text-gold-600">
                  <Trophy className="h-3 w-3" /> Most common: {topBucket.bracket.label}
                </span>
              )}
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={result.buckets} margin={{ left: 4, right: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} vertical={false} />
                <XAxis dataKey="bracket.label" {...CHART_AXIS_PROPS} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} {...CHART_AXIS_PROPS} />
                <Tooltip
                  contentStyle={CHART_TOOLTIP_STYLE}
                  formatter={(value: number, _name, item) => [`${value} (${item.payload.percent.toFixed(1)}%)`, "Count"]}
                />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {result.buckets.map((bucket, i) => (
                    <Cell key={bucket.value} fill={colorFor(i, bucket.suppressed)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {hasSuppressed && (
              <p className="mt-3 text-xs text-ink-faint">
                Small buckets have been merged into &ldquo;Other (suppressed)&rdquo; to protect patient privacy.
              </p>
            )}
          </div>
        </div>
      );
    }

    case "categorySummary": {
      if (result.breakdown.length === 0) return <NotEnoughDataNotice />;

      const hasSuppressed = result.breakdown.some((b) => b.suppressed);
      const topSlice = result.breakdown.reduce<(typeof result.breakdown)[number] | null>(
        (best, b) => (!b.suppressed && (!best || b.count > best.count) ? b : best),
        null
      );
      return (
        <div className="panel">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-soft">
              <PieChartIcon className="h-3.5 w-3.5 text-gold-500" /> {field.label} breakdown
            </h3>
            {topSlice && topSlice.count > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-gold-50 px-2.5 py-1 text-xs font-medium text-gold-600">
                <Trophy className="h-3 w-3" /> Most common: {topSlice.value}
              </span>
            )}
          </div>
          <ResponsiveContainer width="100%" height={340}>
            <PieChart>
              <Pie
                data={result.breakdown}
                dataKey="count"
                nameKey="value"
                outerRadius={110}
                label={(d) => `${d.name}: ${d.payload.percent.toFixed(1)}%`}
              >
                {result.breakdown.map((entry, i) => (
                  <Cell key={entry.value} fill={colorFor(i, entry.suppressed)} stroke="#fff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip contentStyle={CHART_TOOLTIP_STYLE} formatter={(value: number, name) => [value, name]} />
              <Legend wrapperStyle={{ fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
          {hasSuppressed && (
            <p className="mt-3 text-xs text-ink-faint">
              Small groups have been merged into &ldquo;Other (suppressed)&rdquo; to protect patient privacy.
            </p>
          )}
        </div>
      );
    }

    case "ratioScatter":
      // Every branch that returns this kind requires a filter — see aggregate.ts's dispatch.
      return <RatioScatterSection field={field} filter={filter!} points={result.points} />;

    case "ratioByCategory":
      return <RatioByCategorySection field={field} filter={filter!} groups={result.groups} />;

    case "categoryByCategory":
      return <CategoryByCategorySection field={field} filter={filter!} cells={result.cells} />;
  }
}
