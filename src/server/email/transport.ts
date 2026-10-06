import nodemailer from "nodemailer";
import { emailConfig } from "@/config/env";
import { emailTransportUnconfiguredError } from "@/server/email/errors";

export interface Mailer {
  send(msg: { to: string; subject: string; text: string; html: string }): Promise<void>;
}

class SmtpMailer implements Mailer {
  private transport: ReturnType<typeof nodemailer.createTransport>;
  private from: string;

  constructor(config: NonNullable<typeof emailConfig>) {
    this.from = config.from;
    this.transport = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: config.user ? { user: config.user, pass: config.password } : undefined,
    });
  }

  async send(msg: { to: string; subject: string; text: string; html: string }): Promise<void> {
    await this.transport.sendMail({ from: this.from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
  }
}

// Logs the full message including any URL in it, so local dev needs no SMTP account at all.
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
    mailer = new SmtpMailer(emailConfig);
  } else if (process.env.NODE_ENV !== "production") {
    mailer = new ConsoleMailer();
  } else {
    throw emailTransportUnconfiguredError();
  }

  return mailer;
}
