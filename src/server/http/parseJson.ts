import type { NextRequest } from "next/server";
import type { ZodSchema } from "zod";
import { ValidationError } from "./errors";

/** Parses and validates a request body against `schema`, throwing ValidationError (detail: "REQUEST.SHAPE_INVALID") on failure. */
export async function parseJson<T>(req: NextRequest | Request, schema: ZodSchema<T>): Promise<T> {
  const raw = await req.json().catch(() => undefined);
  const result = schema.safeParse(raw);
  if (!result.success) {
    const flattened = result.error.flatten().fieldErrors as Record<string, string[] | undefined>;
    const fieldErrors: Record<string, string> = {};
    for (const [field, messages] of Object.entries(flattened)) {
      if (messages && messages.length > 0) fieldErrors[field] = messages[0]!;
    }
    throw new ValidationError("The request body didn't match the expected shape.", fieldErrors, "REQUEST.SHAPE_INVALID");
  }
  return result.data;
}
