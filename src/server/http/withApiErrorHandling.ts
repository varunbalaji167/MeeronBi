import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";
import { AppError } from "./errors";
import { log } from "./logger";

// Wraps a route handler so any thrown error becomes a well-formed JSON response with a request id.
export function withApiErrorHandling<Args extends any[]>(
  handler: (...args: Args) => Promise<Response>
) {
  return async (...args: Args): Promise<Response> => {
    const requestId = crypto.randomUUID().slice(0, 8);
    try {
      const res = await handler(...args);
      res.headers.set("x-request-id", requestId);
      return res;
    } catch (err) {
      if (err instanceof AppError) {
        log.warn({ requestId, code: err.code, detail: err.detail }, err.message);
        return NextResponse.json(
          { error: err.message, code: err.code, detail: err.detail, fieldErrors: err.fieldErrors, requestId },
          { status: err.statusCode, headers: { "x-request-id": requestId } }
        );
      }
      // Next.js's internal dynamic-rendering signal, not a real error — rethrow untouched.
      if (err && typeof err === "object" && (err as { digest?: string }).digest === "DYNAMIC_SERVER_USAGE") {
        throw err;
      }
      log.error({ requestId, err: err instanceof Error ? err.stack ?? err.message : String(err) }, "Unhandled API error");
      if (process.env.SENTRY_DSN) {
        Sentry.captureException(err, { tags: { requestId } });
      }
      return NextResponse.json(
        {
          error:
            "Something went wrong on the server. If this just started happening, check that all database migrations have been applied (`npx prisma migrate dev`).",
          code: "INTERNAL_ERROR",
          requestId,
        },
        { status: 500, headers: { "x-request-id": requestId } }
      );
    }
  };
}
