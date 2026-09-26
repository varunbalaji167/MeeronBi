// Computes gestational age from LMP and whether it falls within an ultrasound section's
// recommended window. Advisory only — never blocks or hides a section.

export interface GestationalAge {
  /** Completed weeks (e.g. 12 for "12 weeks 3 days"). */
  weeks: number;
  /** Remainder days within the current week (0-6). */
  days: number;
  /** Total days since LMP — the raw value most comparisons should use. */
  totalDays: number;
}

/** Computes gestational age from LMP as of a reference date; null if missing/unparseable or implausible (negative or past ~45 weeks). */
export function computeGestationalAge(lmp: string | null | undefined, asOf: Date = new Date()): GestationalAge | null {
  if (!lmp) return null;
  const lmpDate = new Date(lmp);
  if (Number.isNaN(lmpDate.getTime())) return null;
  const totalDays = Math.floor((asOf.getTime() - lmpDate.getTime()) / 86_400_000);
  if (totalDays < 0 || totalDays > 45 * 7) return null;
  return { weeks: Math.floor(totalDays / 7), days: totalDays % 7, totalDays };
}

export function formatGestationalAge(ga: GestationalAge | null): string {
  if (!ga) return "—";
  return `${ga.weeks}w${ga.days}d`;
}

/** A textbook recommended window for a given ultrasound/section, in days-since-LMP. */
export interface GestationalWindow {
  minDays: number;
  maxDays: number;
  /** Short human label shown on the badge, e.g. "11w0d – 13w6d". */
  label: string;
}

export function isWithinWindow(ga: GestationalAge | null, window: GestationalWindow | GestationalWindow[]): boolean {
  if (!ga) return false;
  const windows = Array.isArray(window) ? window : [window];
  return windows.some((w) => ga.totalDays >= w.minDays && ga.totalDays <= w.maxDays);
}

/** Convenience constructor so tab configs can write `weeksWindow(11, 0, 13, 6, ...)` instead of raw day math. */
export function weeksWindow(minWeeks: number, minExtraDays: number, maxWeeks: number, maxExtraDays: number, label: string): GestationalWindow {
  return { minDays: minWeeks * 7 + minExtraDays, maxDays: maxWeeks * 7 + maxExtraDays, label };
}
