// Structured logging wrapper: logs to console always, and forwards to Sentry when SENTRY_DSN is set.

type LogContext = Record<string, unknown> & { requestId?: string };

function write(level: "info" | "warn" | "error", ctx: LogContext, msg: string) {
  const line = { level, msg, ...ctx, time: new Date().toISOString() };
  const consoleMethod = level === "info" ? console.log : level === "warn" ? console.warn : console.error;
  consoleMethod(JSON.stringify(line));

  if (process.env.SENTRY_DSN) {
    // Required lazily so envs without Sentry configured never load it.
    const Sentry = require("@sentry/nextjs");
    if (level === "error") {
      Sentry.captureMessage(msg, { level: "error", extra: ctx });
    } else {
      Sentry.addBreadcrumb({ category: "log", level, message: msg, data: ctx });
    }
  }
}

export const log = {
  info: (ctx: LogContext, msg: string) => write("info", ctx, msg),
  warn: (ctx: LogContext, msg: string) => write("warn", ctx, msg),
  error: (ctx: LogContext, msg: string) => write("error", ctx, msg),
};
