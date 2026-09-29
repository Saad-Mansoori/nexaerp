import type { LoggerOptions } from 'pino';
import { stdTimeFunctions } from 'pino';

export const REDACTED_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
];

export function buildPinoOptions(level: string): LoggerOptions {
  return {
    level,
    redact: {
      paths: REDACTED_PATHS,
      censor: '[redacted]',
    },
    timestamp: stdTimeFunctions.isoTime,
  };
}
