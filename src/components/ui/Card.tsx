import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

// Mirror of globals.css .panel: change here, then mirror there.
const BASE = "rounded-lg border border-line bg-white shadow-panel";

const PADDING = { none: "", md: "p-5" } as const;

const HEADER =
  "mb-4 flex flex-wrap items-center border-l-2 border-brand-200 pl-3 text-sm font-semibold uppercase tracking-wide text-ink-soft";

interface Props {
  title?: ReactNode;
  actions?: ReactNode;
  /** Rendered right after the title, e.g. a GestationalWindowBadge. */
  titleAfter?: ReactNode;
  scrollX?: boolean;
  padding?: keyof typeof PADDING;
  as?: ElementType;
  /** Placement only. */
  className?: string;
  children?: ReactNode;
}

export default function Card({
  title,
  actions,
  titleAfter,
  scrollX,
  padding = "md",
  as: Tag = "section",
  className,
  children,
}: Props) {
  const hasHeader = title != null || actions != null || titleAfter != null;
  return (
    <Tag className={cn(BASE, PADDING[padding], scrollX && "overflow-x-auto", className)}>
      {hasHeader && (
        <div className={cn(HEADER, actions != null && "justify-between gap-2")}>
          <h3 className="flex flex-wrap items-center gap-2">
            {title}
            {titleAfter}
          </h3>
          {actions}
        </div>
      )}
      {children}
    </Tag>
  );
}
