export type ToastKind = "success" | "error" | "info";

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  repeat: number;
  action?: ToastAction;
  exiting?: boolean;
}

export const MAX_STACK = 4;

interface Incoming {
  id: number;
  kind: ToastKind;
  message: string;
  action?: ToastAction;
}

export interface EnqueueResult {
  queue: Toast[];
  /** The toast that now represents this message: the existing one on a dedup, else `incoming.id`. */
  id: number;
  /** Ids evicted by the cap, so the caller can clear their timers. */
  dropped: number[];
}

export function enqueue(queue: Toast[], incoming: Incoming): EnqueueResult {
  // A toast carrying an action is never merged, so its button can't be lost or inherited.
  const dedupable = !incoming.action;
  const existing = dedupable
    ? queue.find((t) => !t.action && !t.exiting && t.kind === incoming.kind && t.message === incoming.message)
    : undefined;

  if (existing) {
    return {
      queue: queue.map((t) => (t.id === existing.id ? { ...t, repeat: t.repeat + 1 } : t)),
      id: existing.id,
      dropped: [],
    };
  }

  const next = [...queue, { ...incoming, repeat: 1 }];
  const overflow = Math.max(0, next.length - MAX_STACK);
  return {
    queue: next.slice(overflow),
    id: incoming.id,
    dropped: next.slice(0, overflow).map((t) => t.id),
  };
}

export function markExiting(queue: Toast[], id: number): Toast[] {
  return queue.map((t) => (t.id === id ? { ...t, exiting: true } : t));
}

export function remove(queue: Toast[], id: number): Toast[] {
  return queue.filter((t) => t.id !== id);
}
