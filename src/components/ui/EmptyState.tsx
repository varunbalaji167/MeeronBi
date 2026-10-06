import type { ReactNode } from "react";
import Illustration, { type IllustrationName } from "./Illustration";

export type { IllustrationName };

export default function EmptyState({
  icon,
  illustration,
  title,
  description,
  action,
}: {
  /** Small glyph fallback; ignored when `illustration` is given. */
  icon?: ReactNode;
  illustration?: IllustrationName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
      {illustration ? (
        <Illustration name={illustration} />
      ) : (
        icon && (
          <span className="text-ink-faint" aria-hidden="true">
            {icon}
          </span>
        )
      )}
      <p className="font-medium text-ink-soft">{title}</p>
      {description && <p className="text-sm text-ink-faint">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
