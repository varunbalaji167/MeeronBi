// Pre-React-19 shape of the Suspense resource — callers own fetch + caching.

type Resource<T> = { read(): T };

/** `.read()` throws the promise while pending, throws the error once rejected, returns the value once resolved. */
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
