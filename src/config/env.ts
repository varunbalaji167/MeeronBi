// Server-only, Zod-parsed env for the email pipeline and Google sign-in. Not a general env
// module — existing env var access elsewhere in the codebase is untouched.

import { z } from "zod";
import { emailTransportUnconfiguredError } from "@/server/email/errors";

const emailSchema = z.object({
  host: z.string().min(1),
  port: z.coerce.number().int().positive(),
  // Not z.coerce.boolean(): Boolean("false") is true in JS, which silently forced every
  // SMTP_SECURE="false" to `true` and broke STARTTLS on port 587.
  secure: z.union([z.boolean(), z.string()]).transform((v) => (typeof v === "boolean" ? v : v === "true")),
  user: z.string().optional(),
  password: z.string().optional(),
  from: z.string().min(1),
});

const googleSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

export type EmailConfig = z.infer<typeof emailSchema>;
export type GoogleConfig = z.infer<typeof googleSchema>;

// null means SMTP_HOST is unset — dev falls back to console transport, production must throw.
export const emailConfig: EmailConfig | null = process.env.SMTP_HOST
  ? emailSchema.parse({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT ?? 587,
      secure: process.env.SMTP_SECURE ?? false,
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      from: process.env.EMAIL_FROM ?? "MeeronBi <no-reply@meeronbi.org>",
    })
  : null;

// null means the Google sign-in button simply doesn't appear.
export const googleConfig: GoogleConfig | null =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? googleSchema.parse({
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      })
    : null;

// Reused as the absolute base for links in email — never add a separate APP_URL.
export const appUrl: string = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

/** Called by the worker at boot in production so a misconfigured deploy dies visibly. */
export function assertEmailConfigured(): void {
  if (!emailConfig) throw emailTransportUnconfiguredError();
}
