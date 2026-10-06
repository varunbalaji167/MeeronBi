import { describe, it, expect } from "vitest";
import { enqueue, markExiting, remove, MAX_STACK, type Toast } from "./toastQueue";

const base = (id: number, message: string, kind: Toast["kind"] = "error"): Toast => ({
  id,
  kind,
  message,
  repeat: 1,
});

describe("enqueue", () => {
  it("dedups by (kind, message), bumps repeat and holds position", () => {
    const q = [base(1, "A"), base(2, "B")];
    const r = enqueue(q, { id: 3, kind: "error", message: "A" });
    expect(r.queue.map((t) => t.id)).toEqual([1, 2]);
    expect(r.queue[0].repeat).toBe(2);
    expect(r.id).toBe(1);
  });

  it("drops the oldest first once MAX_STACK is exceeded", () => {
    let q: Toast[] = [];
    for (let i = 1; i <= MAX_STACK; i++) q = enqueue(q, { id: i, kind: "info", message: `m${i}` }).queue;
    const r = enqueue(q, { id: 99, kind: "info", message: "new" });
    expect(r.queue).toHaveLength(MAX_STACK);
    expect(r.queue[0].id).toBe(2);
    expect(r.queue.at(-1)!.id).toBe(99);
    expect(r.dropped).toEqual([1]);
  });

  it("keeps distinct messages, and the same message with a different kind, separate", () => {
    let q = enqueue([], { id: 1, kind: "error", message: "A" }).queue;
    q = enqueue(q, { id: 2, kind: "error", message: "B" }).queue;
    q = enqueue(q, { id: 3, kind: "success", message: "A" }).queue;
    expect(q.map((t) => t.id)).toEqual([1, 2, 3]);
  });

  it("never dedups an action-bearing toast into a plain one, or the reverse", () => {
    const action = { label: "Retry", onClick: () => {} };
    const plain = enqueue([], { id: 1, kind: "error", message: "A" }).queue;
    const withAction = enqueue(plain, { id: 2, kind: "error", message: "A", action });
    expect(withAction.queue.map((t) => t.id)).toEqual([1, 2]);
    const plainAgain = enqueue(withAction.queue, { id: 3, kind: "error", message: "A" });
    expect(plainAgain.queue.find((t) => t.id === 1)!.repeat).toBe(2);
    expect(plainAgain.queue.find((t) => t.id === 2)!.repeat).toBe(1);
  });

  it("does not dedup into a toast that is already exiting", () => {
    const q = markExiting([base(1, "A")], 1);
    const r = enqueue(q, { id: 2, kind: "error", message: "A" });
    expect(r.queue.map((t) => t.id)).toEqual([1, 2]);
  });

  it("does not mutate its input array or its toasts", () => {
    const q = Object.freeze([Object.freeze(base(1, "A"))]) as Toast[];
    expect(() => enqueue(q, { id: 2, kind: "error", message: "A" })).not.toThrow();
    expect(() => enqueue(q, { id: 2, kind: "error", message: "B" })).not.toThrow();
    expect(q).toHaveLength(1);
    expect(q[0].repeat).toBe(1);
  });
});

describe("markExiting / remove", () => {
  it("flags only the target toast and removes by id", () => {
    const q = [base(1, "A"), base(2, "B")];
    expect(markExiting(q, 2).map((t) => !!t.exiting)).toEqual([false, true]);
    expect(remove(q, 1).map((t) => t.id)).toEqual([2]);
  });
});
