"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { CheckCircle2, AlertCircle, Info, X, type LucideIcon } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, kind?: ToastKind) => void;
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

const AUTO_DISMISS_MS = 4200;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, kind: ToastKind = "info") => {
      const id = ++counter.current;
      setToasts((prev) => [...prev, { id, kind, message }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ showToast }}>
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
              role="status"
              className={`animate-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border px-4 py-3 pr-2 text-sm shadow-panel ${KIND_STYLES[t.kind]}`}
            >
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${KIND_ICON_COLOR[t.kind]}`} />
              <span className="flex-1">{t.message}</span>
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
