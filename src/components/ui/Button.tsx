import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import Spinner from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "outline";
export type ButtonSize = "sm" | "md";

// Mirror of globals.css .btn-*: change here, then mirror there. Delete the shim when `grep -r "btn-" src` is empty.
const BASE =
  "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-brand-500 text-white shadow-sm hover:bg-brand-600",
  secondary: "border border-brand-200 bg-brand-50 text-brand-700 shadow-sm hover:bg-brand-100",
  danger: "border border-rose-200 bg-white text-rose-600 shadow-sm hover:bg-rose-50",
  ghost: "text-ink-soft hover:bg-paper hover:text-ink",
  outline: "border border-line text-ink-soft hover:bg-paper hover:text-ink",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1 text-xs",
  md: "px-4 py-2 text-sm",
};

// Ghost-style buttons have always been tighter than the other variants at md.
const QUIET_MD = "px-3 py-1.5 text-sm";

export function buttonClasses(variant: ButtonVariant, size: ButtonSize) {
  const quiet = variant === "ghost" || variant === "outline";
  return cn(BASE, VARIANT[variant], quiet && size === "md" ? QUIET_MD : SIZE[size]);
}

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "disabled"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  /** Why the button is unavailable; announced to assistive tech and keeps the button focusable. */
  disabledReason?: string;
  /** Placement only (ml-auto, w-full, shrink-0). Variant/size own padding, text, colour and border. */
  className?: string;
}

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
  variant = "primary",
  size = "md",
  loading,
  icon,
  disabledReason,
  className,
  onClick,
  type = "button",
  children,
  ...rest
  },
  ref,
) {
  const blocked = loading || !!disabledReason;

  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      aria-disabled={blocked || undefined}
      aria-busy={loading || undefined}
      // Guard is required: aria-disabled alone leaves the button live.
      onClick={(e) => {
        if (blocked) {
          e.preventDefault();
          return;
        }
        onClick?.(e);
      }}
      className={cn(buttonClasses(variant, size), className)}
    >
      {loading ? (
        <Spinner className="h-4 w-4" light={variant === "primary"} />
      ) : (
        icon && <span aria-hidden="true" className="inline-flex">{icon}</span>
      )}
      {children}
      {disabledReason && !loading && <span className="sr-only">{disabledReason}</span>}
    </button>
  );
});

export default Button;
