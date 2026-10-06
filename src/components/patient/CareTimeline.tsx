import Link from "next/link";
import { allTabs } from "@/domain/tabs";
import { User, History as HistoryIcon, FlaskConical, Waves, Baby, BarChart3, Pill, type LucideIcon } from "lucide-react";

const TAB_ICONS: Record<string, LucideIcon> = {
  personal: User,
  history: HistoryIcon,
  investigation: FlaskConical,
  ultrasound: Waves,
  delivery: Baby,
  robson: BarChart3,
  treatments: Pill,
};

export type StageStatus = "complete" | "draft" | "empty";

interface Props {
  /** If provided, each stage is rendered with its status colour. */
  statusByKey?: Record<string, StageStatus>;
  /** Highlights the current stage (used on patient tab pages). */
  activeKey?: string;
  /** Render each stage as a link to `hrefBase/{route}`. */
  hrefBase?: string;
  /** If set alongside hrefBase, clicking a stage calls this instead of navigating directly. */
  onNavigate?: (href: string) => void;
  /** Alternative to hrefBase: handle stage selection without navigation. */
  onSelectKey?: (key: string) => void;
  size?: "sm" | "lg";
  /** Use on a dark background (e.g. the login page's brand panel). */
  variant?: "light" | "dark";
}

const dotClasses: Record<StageStatus, string> = {
  complete: "bg-brand-500 border-brand-500 text-white",
  draft: "bg-gold-50 border-gold-500 text-gold-600",
  empty: "bg-white border-line text-ink-faint",
};

const dotClassesDark: Record<StageStatus, string> = {
  complete: "bg-white border-white text-brand-700",
  draft: "bg-gold-200 border-gold-200 text-brand-800",
  empty: "bg-transparent border-white/30 text-white/60",
};

export default function CareTimeline({
  statusByKey,
  activeKey,
  hrefBase,
  onNavigate,
  onSelectKey,
  size = "sm",
  variant = "light",
}: Props) {
  const dark = variant === "dark";
  const dotSize = size === "lg" ? "h-9 w-9 text-sm" : "h-7 w-7 text-xs";
  const classes = dark ? dotClassesDark : dotClasses;

  const content = allTabs.map((tab, i) => {
    const status: StageStatus = statusByKey?.[tab.key] ?? "empty";
    const isActive = activeKey === tab.key;
    const href = hrefBase ? `${hrefBase}/${tab.route}` : undefined;
    const StageIcon = TAB_ICONS[tab.key];
    const statusLabel = status === "complete" ? "complete" : status === "draft" ? "draft" : "not started";
    const stepLabel = `Step ${i + 1}: ${tab.label} (${statusLabel})`;
    const dot = (
      <span
        aria-hidden="true"
        className={`flex ${dotSize} shrink-0 items-center justify-center rounded-full border-2 font-semibold transition-colors ${classes[status]} ${
          isActive ? `ring-2 ring-offset-2 ${dark ? "ring-white/50 ring-offset-brand-700" : "ring-brand-300 ring-offset-paper"}` : ""
        }`}
      >
        {i + 1}
      </span>
    );
    return (
      <li key={tab.key} className="flex flex-1 flex-col items-center gap-2 text-center">
        <div className="flex w-full items-center">
          <span aria-hidden="true" className={`h-px flex-1 ${i === 0 ? "bg-transparent" : dark ? "bg-white/20" : "bg-line"}`} />
          {href && onNavigate ? (
            <button type="button" onClick={() => onNavigate(href)} aria-label={stepLabel} aria-current={isActive ? "step" : undefined}>
              {dot}
            </button>
          ) : href ? (
            <Link href={href} aria-label={stepLabel} aria-current={isActive ? "step" : undefined}>
              {dot}
            </Link>
          ) : onSelectKey ? (
            <button
              type="button"
              onClick={() => onSelectKey(tab.key)}
              aria-label={stepLabel}
              aria-current={isActive ? "step" : undefined}
            >
              {dot}
            </button>
          ) : (
            <span aria-label={stepLabel}>{dot}</span>
          )}
          <span
            aria-hidden="true"
            className={`h-px flex-1 ${i === allTabs.length - 1 ? "bg-transparent" : dark ? "bg-white/20" : "bg-line"}`}
          />
        </div>
        <span
          aria-hidden="true"
          className={`hidden items-center gap-1 text-xs font-medium sm:flex ${
            dark
              ? isActive
                ? "text-white"
                : "text-brand-100/80"
              : isActive
              ? "text-brand-700"
              : "text-ink-soft"
          }`}
        >
          {StageIcon && <StageIcon className="h-3 w-3" />}
          {tab.label}
        </span>
      </li>
    );
  });

  const activeIndex = allTabs.findIndex((t) => t.key === activeKey);

  return (
    <div className="w-full">
      <ol className="flex w-full items-start" aria-label="Antenatal care record stages">
        {content}
      </ol>
      {/* Below sm the per-stage labels are hidden, so name the current stage in words; the dots' own aria-labels already cover screen readers. */}
      {activeIndex >= 0 && (
        <p
          aria-hidden="true"
          className={`mt-3 text-center text-xs font-medium sm:hidden ${dark ? "text-white" : "text-brand-700"}`}
        >
          Step {activeIndex + 1} of {allTabs.length} — {allTabs[activeIndex].label}
        </p>
      )}
    </div>
  );
}
