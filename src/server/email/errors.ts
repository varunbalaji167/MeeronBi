// Namespaced `detail` codes for the email pipeline — same pattern as server/auth/errors.ts.

import { AppError } from "@/server/http/errors";

export const EMAIL_ERROR = {
  TRANSPORT_UNCONFIGURED: "EMAIL.TRANSPORT_UNCONFIGURED",
  PAYLOAD_INVALID: "EMAIL.PAYLOAD_INVALID",
} as const;

/** SMTP is required (production) but no SMTP_HOST is configured. */
export function emailTransportUnconfiguredError(): AppError {
  return new AppError(
    "Email transport is not configured — set SMTP_HOST and related env vars.",
    500,
    "INTERNAL_ERROR",
    undefined,
    EMAIL_ERROR.TRANSPORT_UNCONFIGURED
  );
}

/** A stored outbox row's payload no longer matches the EmailPayload schema (template changed since enqueue). */
export function emailPayloadInvalidError(message: string): AppError {
  return new AppError(message, 500, "INTERNAL_ERROR", undefined, EMAIL_ERROR.PAYLOAD_INVALID);
}
