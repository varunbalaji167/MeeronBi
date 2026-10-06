import type { ReactNode } from "react";

export default function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      <span className="text-ink-faint" aria-hidden="true">
        {icon}
      </span>
      <p className="font-medium text-ink-soft">{title}</p>
      {description && <p className="text-sm text-ink-faint">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
