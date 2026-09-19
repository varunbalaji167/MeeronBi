import { GestationalAge, GestationalWindow, formatGestationalAge, isWithinWindow } from "@/domain/gestationalAge";

/**
 * Purely informational — see domain/gestationalAge.ts for why this never
 * hides or disables the section it's attached to. Three states:
 *  - no LMP on file yet: just the recommended window ("Recommended: 11w0d – 13w6d")
 *  - LMP on file, currently inside the window: an accent "In window now" pill
 *  - LMP on file, outside the window: the window plus how far off ("now at 15w2d")
 */
export default function GestationalWindowBadge({
  window,
  ga,
}: {
  window: GestationalWindow | GestationalWindow[];
  ga: GestationalAge | null;
}) {
  const windows = Array.isArray(window) ? window : [window];
  const label = windows.map((w) => w.label).join(" or ");
  const inWindow = isWithinWindow(ga, window);
  return (
    <span
      className={`ml-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-normal normal-case tracking-normal ${
        inWindow ? "bg-brand-100 text-brand-700" : "bg-paper text-ink-faint border border-line"
      }`}
      title="Textbook timing window — informational only, doesn't restrict data entry"
    >
      Recommended: {label}
      {ga && (inWindow ? " · in window now" : ` · now at ${formatGestationalAge(ga)}`)}
    </span>
  );
}
