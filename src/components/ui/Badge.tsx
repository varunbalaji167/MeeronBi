import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type BadgeVariant = "draft" | "complete";

// Mirror of globals.css .badge-*: change here, then mirror there.
const BASE = "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium";

const VARIANT: Record<BadgeVariant, string> = {
  draft: "bg-gold-50 text-gold-600",
  complete: "bg-brand-50 text-brand-700",
};

export default function Badge({
  variant,
  className,
  children,
}: {
  variant: BadgeVariant;
  /** Placement only. */
  className?: string;
  children: ReactNode;
}) {
  return <span className={cn(BASE, VARIANT[variant], className)}>{children}</span>;
}
