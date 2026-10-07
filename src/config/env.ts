// Server-only, Zod-parsed env for the email pipeline and Google sign-in. Not a general env
// module — existing env var access elsewhere in the codebase is untouched.

import { z } from "zod";
import { emailTransportUnconfiguredError } from "@/server/email/errors";

const emailSchema = z.object({
  apiKey: z.string().min(1),
  from: z.string().min(1),
});

const googleSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
});

export type EmailConfig = z.infer<typeof emailSchema>;
export type GoogleConfig = z.infer<typeof googleSchema>;

// null means RESEND_API_KEY is unset — dev falls back to console transport, production must throw.
export const emailConfig: EmailConfig | null = process.env.RESEND_API_KEY
  ? emailSchema.parse({
      apiKey: process.env.RESEND_API_KEY,
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
