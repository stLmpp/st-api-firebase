import { format } from 'node:util';

import {
  getCorrelationId,
  getExecutionId,
  getStateMetadata,
  getStateMetadataKey,
  getTraceId,
  safe,
} from '@st-api/core';
import { LogEntry, LogSeverity } from 'firebase-functions/logger';
import { logger } from 'firebase-functions/v2';
import { ConditionalKeys } from 'type-fest';

import { isEmulator } from './common/is-emulator.js';
import { removeCircular } from './common/remove-circular.js';

export const LOGGER_CONTEXT = Symbol('LoggerContext');

interface EntryFromArgs {
  severity: LogSeverity;
  args: unknown[];
  scope?: string;
}

/**
 * @description Similar implementation from {@link https://github.com/firebase/firebase-functions/blob/master/src/logger/index.ts}
 * @param args
 * @param scope
 * @param severity
 */
function entryFromArgs({ args, scope, severity }: EntryFromArgs): LogEntry {
  let { entry, message, traceId, correlationId, executionId } =
    getEntryAndMessage(args);
  if (
    severity === 'ERROR' &&
    !args.some((argument) => argument instanceof Error)
  ) {
    message = new Error(message).stack || message;
  }
  const out: LogEntry = {
    'logging.googleapis.com/trace': traceId
      ? `projects/${process.env.GCLOUD_PROJECT}/traces/${traceId}`
      : undefined,
    ...entry,
    severity,
    metadata: {
      traceId,
      correlationId,
      executionId,
      scope,
    },
  };
  if (message) {
    out.message = message;
  }
  return out;
}

function getEntryAndMessage(args: unknown[]) {
  const [, context] = safe(() => getStateMetadataKey(LOGGER_CONTEXT));
  if (context) {
    args.unshift(`[${String(context)}]`);
  }
  let entry: object = {};
  const lastArgument = args.at(-1);
  if (
    lastArgument &&
    typeof lastArgument === 'object' &&
    lastArgument.constructor === Object
  ) {
    args.pop();
    entry = lastArgument;
  }
  const message = format(...args);
  const [, traceId] = safe(() => getTraceId());
  const [, correlationId] = safe(() => getCorrelationId());
  const [, executionId] = safe(() => getExecutionId());
  return { entry, message, traceId, correlationId, executionId };
}

const fromSeverityToConsoleLog: Record<
  LogSeverity,
  ConditionalKeys<typeof console, (...args: unknown[]) => unknown>
> = {
  ALERT: 'warn',
  CRITICAL: 'error',
  DEBUG: 'debug',
  EMERGENCY: 'error',
  ERROR: 'error',
  INFO: 'log',
  NOTICE: 'info',
  WARNING: 'warn',
};

export class Logger {
  private constructor(private readonly scope?: string) {}

  write(severity: LogSeverity, args: unknown[]): void {
    Logger.write(severity, this.scope, args);
  }

  debug(...args: unknown[]): void {
    this.write('DEBUG', args);
  }

  log(...args: unknown[]): void {
    this.write('INFO', args);
  }

  info(...args: unknown[]): void {
    this.write('INFO', args);
  }

  warn(...args: unknown[]): void {
    this.write('WARNING', args);
  }

  error(...args: unknown[]): void {
    this.write('ERROR', args);
  }

  static write(
    severity: LogSeverity,
    scope: string | undefined,
    args: unknown[],
  ): void {
    if (isEmulator()) {
      const method = fromSeverityToConsoleLog[severity];
      const { entry, message, correlationId, traceId, executionId } =
        getEntryAndMessage(args);
      const object = removeCircular({
        ...entry,
        message,
        metadata: {
          scope,
          traceId,
          correlationId,
          executionId,
        },
      });
      return console[method](
        `[${new Date().toISOString()}]`,
        JSON.stringify(object, null, 2),
      );
    }
    return logger.write(
      entryFromArgs({
        args,
        scope,
        severity,
      }),
    );
  }

  static debug(...args: unknown[]): void {
    this.write('DEBUG', undefined, args);
  }

  static log(...args: unknown[]): void {
    this.write('INFO', undefined, args);
  }

  static info(...args: unknown[]): void {
    this.write('INFO', undefined, args);
  }

  static warn(...args: unknown[]): void {
    this.write('WARNING', undefined, args);
  }

  static error(...args: unknown[]): void {
    this.write('ERROR', undefined, args);
  }

  static setContext(context: string): void {
    safe(() => {
      getStateMetadata().set(LOGGER_CONTEXT, context);
    });
  }

  static create(scope: unknown): Logger {
    let name: string | undefined;
    if (typeof scope === 'string') {
      name = scope;
    } else if (typeof scope === 'function') {
      const descriptor = Object.getOwnPropertyDescriptor(scope, 'prototype');
      if (scope.name && descriptor?.writable === false) {
        name = scope.name;
      } else {
        return Logger.create(scope());
      }
      name = scope.name;
    } else if (typeof scope === 'object' && scope) {
      name = Object.getPrototypeOf(scope)?.constructor?.name;
    }
    return new Logger(name);
  }
}
