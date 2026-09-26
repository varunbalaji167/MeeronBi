// The classic "wrap a promise so a component can suspend on it" resource — the same shape
// React itself used before `use()` existed (React 19). Kept generic and tiny on purpose: it's
// infrastructure for Suspense, not a fetch library — callers own their own fetch + caching.

type Resource<T> = { read(): T };

/** Wraps `promise` so `.read()` throws it (for Suspense) while pending, throws the error once
 * rejected, or returns the value once resolved. Safe to call `.read()` from render repeatedly. */
export function createResource<T>(promise: Promise<T>): Resource<T> {
  let status: "pending" | "success" | "error" = "pending";
  let result: T;
  let error: unknown;

  const suspender = promise.then(
    (value) => {
      status = "success";
      result = value;
    },
    (err) => {
      status = "error";
      error = err;
    }
  );

  return {
    read(): T {
      if (status === "pending") throw suspender;
      if (status === "error") throw error;
      return result;
    },
  };
}
