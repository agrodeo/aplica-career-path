import pino from "pino";

export const logger = pino({
  level: process.env["LOG_LEVEL"] ?? "info",
  redact: {
    paths: ["email", "phone", "answers", "profile", "*.email", "*.phone", "req.headers.authorization"],
    censor: "[redacted]",
  },
  base: { service: "aplica-auto-apply-worker" },
});

export type Logger = typeof logger;
