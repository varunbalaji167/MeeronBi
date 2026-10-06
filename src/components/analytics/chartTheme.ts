import { brand, gold, rose, line, ink, chartExtras } from "@/lib/design/palette";

// Shared recharts theming for the app's aggregate charts (public trends + analytics workbench),
// so both read as one visual system. Categorical hues are assigned in this fixed order — never
// cycled arbitrarily per-chart — per the dataviz skill's color-formula guidance.
// Literal hex from the palette, not CSS vars: recharts fills/legend icons can't resolve var().
export const CHART_COLORS = [brand[500], gold[500], brand[300], rose[500], brand[400], gold[200]];

export const CHART_GRID_STROKE = line.DEFAULT;
export const CHART_AXIS_STROKE = ink.faint;

export const CHART_TOOLTIP_STYLE = { borderRadius: 8, borderColor: CHART_GRID_STROKE, fontSize: 13 };

export const CHART_AXIS_PROPS = { fontSize: 12, stroke: CHART_AXIS_STROKE };

/** Color reserved for a merged "Other (suppressed)" bucket — deliberately gray, outside the categorical order. */
export const SUPPRESSED_COLOR = chartExtras.suppressed;

/** Color for a reference-range annotation (e.g. TSH's clinical band) — a secondary encoding, never reused for a data series. */
export const REFERENCE_BAND_COLOR = chartExtras.referenceBand;
