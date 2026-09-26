"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { TrendingUp } from "lucide-react";
import { AnalyticsFieldMeta, TimeSeriesResult, TRIMESTER_BUCKET_LABELS, TRIMESTER_BUCKET_ORDER } from "@/domain/analytics/types";
import { CHART_AXIS_PROPS, CHART_COLORS, CHART_GRID_STROKE, CHART_TOOLTIP_STYLE, REFERENCE_BAND_COLOR } from "./chartTheme";

function NoDataNotice() {
  return <div className="panel text-sm text-ink-soft">No data available for this selection yet.</div>;
}

/** Reshapes `TimeSeriesResult.series` into one row per trimester bucket (chart's X axis), one column per series, plus reference-band columns when the field carries one (e.g. TSH). */
function buildChartData(series: TimeSeriesResult["series"]) {
  return TRIMESTER_BUCKET_ORDER.map((bucket) => {
    const row: Record<string, number | string | undefined> = { bucket: TRIMESTER_BUCKET_LABELS[bucket] };
    for (const s of series) {
      const point = s.points.find((p) => p.bucket === bucket);
      if (!point) continue;
      row[s.label] = point.value;
      if (point.referenceLow !== undefined) row.referenceLow = point.referenceLow;
      if (point.referenceHigh !== undefined) row.referenceHigh = point.referenceHigh;
    }
    return row;
  });
}

/** Renders a TimeSeriesResult as a line-per-series chart over the four trimester buckets, with an optional dashed reference band (single-patient TSH's clinical range). */
export default function TimeSeriesChart({ field, result }: { field: AnalyticsFieldMeta; result: TimeSeriesResult }) {
  const hasData = result.series.some((s) => s.points.length > 0);
  if (!hasData) return <NoDataNotice />;

  const data = buildChartData(result.series);
  const hasReferenceBand = data.some((row) => row.referenceLow !== undefined);
  const showLegend = result.series.length > 1 || hasReferenceBand;

  return (
    <div className="panel">
      <h3 className="mb-4 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-ink-soft">
        <TrendingUp className="h-3.5 w-3.5 text-brand-500" /> {field.label} across pregnancy
      </h3>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={data} margin={{ left: 4, right: 16, bottom: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID_STROKE} />
          <XAxis dataKey="bucket" {...CHART_AXIS_PROPS} />
          <YAxis allowDecimals {...CHART_AXIS_PROPS} unit={field.unit ? ` ${field.unit}` : undefined} />
          <Tooltip contentStyle={CHART_TOOLTIP_STYLE} />
          {showLegend && <Legend wrapperStyle={{ fontSize: 13 }} />}
          {hasReferenceBand && (
            <>
              <Line
                type="monotone"
                dataKey="referenceLow"
                name="Reference low"
                stroke={REFERENCE_BAND_COLOR}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="referenceHigh"
                name="Reference high"
                stroke={REFERENCE_BAND_COLOR}
                strokeWidth={1.5}
                strokeDasharray="4 3"
                dot={false}
                connectNulls
              />
            </>
          )}
          {result.series.map((s, i) => (
            <Line
              key={s.label}
              type="monotone"
              dataKey={s.label}
              name={s.label}
              stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={2}
              dot={{ r: 4 }}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
