import { format } from 'node:util';

import { getCorrelationId, getTraceId, safe } from '@st-api/core';
import { LogEntry, LogSeverity } from 'firebase-functions/logger';
import { logger } from 'firebase-functions/v2';

interface EntryFromArgs {
  severity: LogSeverity;
  args: unknown[];
  scope?: string;
}

function entryFromArgs({ args, scope, severity }: EntryFromArgs): LogEntry {
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

  let message = format(...args);
  if (
    severity === 'ERROR' &&
    !args.some((argument) => argument instanceof Error)
  ) {
    message = new Error(message).stack || message;
  }
  const [, traceId] = safe(() => getTraceId());
  const [, correlationId] = safe(() => getCorrelationId());
  const out: LogEntry = {
    'logging.googleapis.com/trace': traceId
      ? `projects/${process.env.GCLOUD_PROJECT}/traces/${traceId}`
      : undefined,
    ...entry,
    severity,
    traceId,
    correlationId,
    scope,
  };
  if (message) {
    out.message = message;
  }
  return out;
}

export class Logger {
  private constructor(private readonly scope?: string) {}

  debug(...args: unknown[]): void {
    logger.write(
      entryFromArgs({
        args,
        scope: this.scope,
        severity: 'DEBUG',
      }),
    );
  }
  log(...args: unknown[]): void {
    logger.write(
      entryFromArgs({
        args,
        scope: this.scope,
        severity: 'INFO',
      }),
    );
  }

  info(...args: unknown[]): void {
    logger.write(
      entryFromArgs({
        args,
        scope: this.scope,
        severity: 'INFO',
      }),
    );
  }

  warn(...args: unknown[]): void {
    logger.write(
      entryFromArgs({
        args,
        scope: this.scope,
        severity: 'WARNING',
      }),
    );
  }

  error(...args: unknown[]): void {
    logger.write(
      entryFromArgs({
        args,
        scope: this.scope,
        severity: 'ERROR',
      }),
    );
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
