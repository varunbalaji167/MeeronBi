import { NextResponse } from "next/server";
import { AppError } from "./errors";

/**
 * Wraps a route handler so ANY thrown error becomes a well-formed JSON
 * response instead of an empty or malformed body reaching the client.
 * Without this, an unhandled exception can produce a zero-length response,
 * and `fetch().json()` on the client throws a confusing "Unexpected end of
 * JSON input" that hides the real problem.
 *
 * Two cases, handled differently:
 *  - A known `AppError` (see server/http/errors.ts) — its own statusCode,
 *    code, message, and any fieldErrors are passed straight through. This
 *    is the expected, "this specific thing went wrong" path: a guard
 *    denying access, a validation failure, a conflict with existing data.
 *  - Anything else (a genuine bug, a DB connection failure, a missing
 *    migration) — logged server-side with the real stack trace, but the
 *    client only ever sees a generic message. Never leak internals.
 *
 * Every route.ts handler in this app should be wrapped in this — see any
 * file under src/app/api for the pattern:
 *
 *   export const GET = withApiErrorHandling(async (req, ctx) => { ... });
 */
export function withApiErrorHandling<Args extends any[]>(
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (err) {
      if (err instanceof AppError) {
        return NextResponse.json(
          { error: err.message, code: err.code, fieldErrors: err.fieldErrors },
          { status: err.statusCode }
        );
      }
      console.error("[api] Unhandled error:", err);
      return NextResponse.json(
        {
          error:
            "Something went wrong on the server. If this just started happening, check that all database migrations have been applied (`npx prisma migrate dev`).",
          code: "INTERNAL_ERROR",
        },
        { status: 500 }
      );
    }
  };
}
