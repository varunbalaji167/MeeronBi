// Shared recharts theming for the app's aggregate charts (public trends + analytics workbench),
// so both read as one visual system. Categorical hues are assigned in this fixed order — never
// cycled arbitrarily per-chart — per the dataviz skill's color-formula guidance.
export const CHART_COLORS = ["#0E6B5C", "#B8862E", "#79B7A4", "#A3423D", "#3D8E77", "#EBC97A"];

export const CHART_GRID_STROKE = "#E1E0D5";
export const CHART_AXIS_STROKE = "#6B7268";

export const CHART_TOOLTIP_STYLE = { borderRadius: 8, borderColor: CHART_GRID_STROKE, fontSize: 13 };

export const CHART_AXIS_PROPS = { fontSize: 12, stroke: CHART_AXIS_STROKE };

/** Color reserved for a merged "Other (suppressed)" bucket — deliberately gray, outside the categorical order. */
export const SUPPRESSED_COLOR = "#B8B6A9";

/** Color for a reference-range annotation (e.g. TSH's clinical band) — a secondary encoding, never reused for a data series. */
export const REFERENCE_BAND_COLOR = "#94A39B";
