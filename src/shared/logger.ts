/**
 * Application logger built on pino.
 *
 * Structured JSON in production; pretty output in development.
 * Config is read lazily so importing this module does not require full env.
 */

import pino from 'pino';

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isDevelopment = nodeEnv === 'development';
const level = process.env.LOG_LEVEL ?? (isDevelopment ? 'debug' : 'info');

/** Root pino logger */
export const logger = pino({
  name: 'x-moderator',
  level,
  ...(isDevelopment && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'HH:MM:ss.l',
        ignore: 'pid,hostname',
      },
    },
  }),
  serializers: {
    err: pino.stdSerializers.err,
  },
});

/**
 * Create a child logger with a fixed context label.
 *
 * @param context - Module or service name
 */
export function createLogger(context: string): pino.Logger {
  return logger.child({ context });
}
