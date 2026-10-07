import { emailConfig } from "@/config/env";
import { emailTransportUnconfiguredError } from "@/server/email/errors";

export interface Mailer {
  send(msg: { to: string; subject: string; text: string; html: string }): Promise<void>;
}

// Plain fetch against Resend's REST API — one HTTP call, no SDK dependency to
// track. Resend sends over HTTPS, sidestepping the outbound SMTP port
// blocking that cloud providers (DigitalOcean included) impose by default.
class ResendMailer implements Mailer {
  private apiKey: string;
  private from: string;

  constructor(config: NonNullable<typeof emailConfig>) {
    this.apiKey = config.apiKey;
    this.from = config.from;
  }

  async send(msg: { to: string; subject: string; text: string; html: string }): Promise<void> {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: this.from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Resend send failed (${res.status}): ${body}`);
    }
  }
}

// Logs the full message including any URL in it, so local dev needs no Resend account at all.
class ConsoleMailer implements Mailer {
  async send(msg: { to: string; subject: string; text: string; html: string }): Promise<void> {
    console.log(`[email:console] to=${msg.to} subject=${JSON.stringify(msg.subject)}\n${msg.text}`);
  }
}

// Built once at module scope, not per send.
let mailer: Mailer | null = null;

export function getMailer(): Mailer {
  if (mailer) return mailer;

  if (emailConfig) {
    mailer = new ResendMailer(emailConfig);
  } else if (process.env.NODE_ENV !== "production") {
    mailer = new ConsoleMailer();
  } else {
    throw emailTransportUnconfiguredError();
  }

  return mailer;
}
