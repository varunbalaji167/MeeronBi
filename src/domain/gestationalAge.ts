// ─────────────────────────────────────────────────────────────────────────
// Per the source spec's Ultrasound page ("Ultrasounds are mandatory except
// that specific ultrasounds are done in pre-specified time. Display based
// on LMP.", repeated as "Auto select for display using LMP date" against
// the NT Scan and Anomaly Scan sections): several Ultrasound sections have
// a textbook gestational-age window (NT scan ~11-13w6d, anomaly scan
// ~18-22w, etc.), and the UI should surface where the patient currently
// stands relative to that window.
//
// Deliberately advisory, not enforced: this only computes numbers and a
// yes/no "in window" flag — see domain/tabs/ultrasound.ts's
// `recommendedWindow` on each section and GestationalWindowBadge for how
// it's displayed. It never hides, disables, or blocks a section, because a
// scan can legitimately happen earlier or later than the textbook window
// (a delayed booking, a repeat scan, a referral) and Save as Draft must
// never be gated on it — consistent with how every other soft validation
// in this app works (see domain/validation.ts).
// ─────────────────────────────────────────────────────────────────────────

export interface GestationalAge {
  /** Completed weeks (e.g. 12 for "12 weeks 3 days"). */
  weeks: number;
  /** Remainder days within the current week (0-6). */
  days: number;
  /** Total days since LMP — the raw value most comparisons should use. */
  totalDays: number;
}

/**
 * Computes gestational age from a patient's LMP as of a reference date
 * (defaults to today). Returns null for a missing/unparseable LMP, or one
 * that would put gestational age outside a plausible human pregnancy
 * (negative, or past ~45 weeks) — safer to show nothing than a nonsense
 * "62 weeks pregnant" badge.
 */
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
