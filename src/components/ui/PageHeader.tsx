import type { ReactNode } from "react";

/** The one heading treatment for every authenticated screen: ruled, display-italic, optional kicker/description/action. */
export default function PageHeader({
  title,
  kicker,
  description,
  icon,
  action,
  className = "",
}: {
  title: string;
  kicker?: string;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  /** Placement only, e.g. a bottom margin when the parent isn't a gap-based flex column. */
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5 ${className}`}>
      <div className="min-w-0">
        {kicker && <p className="text-sm text-ink-faint">{kicker}</p>}
        <h1 className="flex items-center gap-2.5 font-display text-2xl italic text-ink">
          {icon}
          {title}
        </h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-ink-soft">{description}</p>}
      </div>
      {action}
    </div>
  );
}
