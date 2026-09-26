import { GestationalAge, GestationalWindow, formatGestationalAge, isWithinWindow } from "@/domain/gestationalAge";

/** Informational badge showing the recommended gestational window and current status. */
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
