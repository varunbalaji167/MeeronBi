"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X, type LucideIcon } from "lucide-react";
import { enqueue, markExiting, remove, type Toast, type ToastAction, type ToastKind } from "@/lib/toastQueue";

interface ToastOptions {
  durationMs?: number;
  action?: ToastAction;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind, opts?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

const KIND_STYLES: Record<ToastKind, string> = {
  success: "border-brand-200 bg-white text-ink",
  error: "border-rose-200 bg-white text-ink",
  info: "border-line bg-white text-ink",
};

const KIND_ICON: Record<ToastKind, LucideIcon> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const KIND_ICON_COLOR: Record<ToastKind, string> = {
  success: "text-brand-500",
  error: "text-rose-500",
  info: "text-gold-500",
};

const DURATION_MS: Record<ToastKind, number> = {
  success: 4200,
  info: 5000,
  error: 12000,
};

const EXIT_MS = 160;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  // The ref is the source of truth so timers and the queue update synchronously, outside React updaters.
  const toastsRef = useRef<Toast[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const commit = useCallback((next: Toast[]) => {
    toastsRef.current = next;
    setToasts(next);
  }, []);

  const clearTimer = useCallback((id: number) => {
    const t = timers.current.get(id);
    if (t !== undefined) clearTimeout(t);
    timers.current.delete(id);
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      clearTimer(id);
      if (!toastsRef.current.some((t) => t.id === id && !t.exiting)) return;
      commit(markExiting(toastsRef.current, id));
      timers.current.set(
        id,
        setTimeout(() => {
          timers.current.delete(id);
          commit(remove(toastsRef.current, id));
        }, EXIT_MS)
      );
    },
    [clearTimer, commit]
  );

  const showToast = useCallback(
    (message: string, kind: ToastKind = "info", opts?: ToastOptions) => {
      const result = enqueue(toastsRef.current, { id: ++counter.current, kind, message, action: opts?.action });
      result.dropped.forEach(clearTimer);
      commit(result.queue);

      clearTimer(result.id);
      // An action toast never auto-dismisses: offering "Retry" then pulling it is worse than no action.
      if (!opts?.action) {
        timers.current.set(
          result.id,
          setTimeout(() => dismiss(result.id), opts?.durationMs ?? DURATION_MS[kind])
        );
      }
    },
    [clearTimer, commit, dismiss]
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* Top-center to avoid colliding with DynamicForm's sticky bottom action bar. */}
      <div
        className="pointer-events-none fixed inset-x-0 top-4 z-[60] flex flex-col items-center gap-2 px-4 sm:top-5"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((t) => {
          const Icon = KIND_ICON[t.kind];
          return (
            <div
              key={t.id}
              role={t.kind === "error" ? "alert" : "status"}
              className={`${t.exiting ? "animate-toast-out" : "animate-toast-in"} pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border px-4 py-3 pr-2 text-sm shadow-panel ${KIND_STYLES[t.kind]}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${KIND_ICON_COLOR[t.kind]}`} />
              <span className="flex-1">{t.message}</span>
              {t.repeat > 1 && (
                <span className="mt-0.5 shrink-0 rounded-full bg-paper px-1.5 text-xs font-medium text-ink-soft">
                  ×{t.repeat}
                </span>
              )}
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    t.action!.onClick();
                    dismiss(t.id);
                  }}
                  className="min-h-[44px] shrink-0 rounded px-2 text-sm font-medium text-brand-700 hover:bg-paper"
                >
                  {t.action.label}
                </button>
              )}
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss"
                className="shrink-0 rounded p-1 text-ink-faint hover:bg-paper hover:text-ink"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
