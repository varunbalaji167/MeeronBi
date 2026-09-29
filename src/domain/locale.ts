// Facility-level date/measurement-unit formatting. Deliberately not full i18n — no string
// translation, no pluralization rules. Just enough that gestational-age/measurement display
// isn't hardcoded to one region, so a second facility with different conventions doesn't need
// this rewritten from scratch. See docs/SCALING_PLAN.md §2.

export type Locale = "en-IN" | "en-US";

export type MeasurementUnit = "cm" | "kg" | "in" | "lb";

interface LocaleConfig {
  /** Passed straight to Date's locale-formatting; also doubles as the date-string parse order below. */
  dateStyle: "dd-mm-yyyy" | "mm-dd-yyyy";
  /** cm/kg (metric) or in/lb (imperial) — which unit a given measurement is displayed in. */
  units: { length: "cm" | "in"; mass: "kg" | "lb" };
}

const LOCALES: Record<Locale, LocaleConfig> = {
  "en-IN": { dateStyle: "dd-mm-yyyy", units: { length: "cm", mass: "kg" } },
  "en-US": { dateStyle: "mm-dd-yyyy", units: { length: "in", mass: "lb" } },
};

const CM_PER_IN = 2.54;
const KG_PER_LB = 0.45359237;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Renders a Date in the facility's locale date style (dd-mm-yyyy for en-IN, mm-dd-yyyy for en-US). */
export function formatDate(d: Date, locale: Locale): string {
  const day = pad2(d.getDate());
  const month = pad2(d.getMonth() + 1);
  const year = d.getFullYear();
  return LOCALES[locale].dateStyle === "dd-mm-yyyy" ? `${day}-${month}-${year}` : `${month}-${day}-${year}`;
}

/**
 * Parses a date string in the facility's locale style. Returns null rather than throwing on a
 * malformed string, matching computeGestationalAge's null-on-bad-input convention.
 */
export function parseDate(s: string, locale: Locale): Date | null {
  const match = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(s.trim());
  if (!match) return null;
  const [, a, b, year] = match;
  const [day, month] = LOCALES[locale].dateStyle === "dd-mm-yyyy" ? [a, b] : [b, a];
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (Number.isNaN(date.getTime())) return null;
  // Reject e.g. 31-02-2026 silently rolling over to March.
  if (date.getDate() !== Number(day) || date.getMonth() !== Number(month) - 1) return null;
  return date;
}

/**
 * Formats a stored metric value (cm or kg — how every existing field is stored) in the
 * facility's preferred display unit, converting if needed.
 */
export function formatMeasurement(value: number, unit: "cm" | "kg", locale: Locale): string {
  const targetLength = LOCALES[locale].units.length;
  const targetMass = LOCALES[locale].units.mass;

  if (unit === "cm") {
    const displayValue = targetLength === "in" ? value / CM_PER_IN : value;
    return `${roundTo1dp(displayValue)} ${targetLength}`;
  }
  const displayValue = targetMass === "lb" ? value / KG_PER_LB : value;
  return `${roundTo1dp(displayValue)} ${targetMass}`;
}

function roundTo1dp(n: number): number {
  return Math.round(n * 10) / 10;
}
