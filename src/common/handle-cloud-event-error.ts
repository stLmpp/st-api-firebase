import { INestApplicationContext, Logger } from '@nestjs/common';
import {
  Exception,
  getCorrelationId,
  getTraceId,
  safe,
  safeAsync,
  UNKNOWN_INTERNAL_SERVER_ERROR,
} from '@st-api/core';
import dayjs from 'dayjs';
import { CloudEvent } from 'firebase-functions/v2';

import { FirebaseAdminFirestore } from '../firebase-admin/firebase-admin-firestore.js';
import { RETRY_EVENT_MAX_DIFF, RetryEvent } from '../retry-event.js';

import { removeCircular } from './remove-circular.js';

export enum CloudEventErrorType {
  Eventarc = 'Eventarc',
  PubSub = 'PubSub',
}

export interface HandleCloudEventErrorOptions {
  event: CloudEvent<unknown>;
  error: Error;
  app: INestApplicationContext;
  type: CloudEventErrorType;
  data: unknown;
}

export type HandleCloudEventPubSubErrorOptions =
  HandleCloudEventErrorOptions & {
    type: CloudEventErrorType.PubSub;
    topic: string;
  };

export type HandleCloudEventEventarcErrorOptions =
  HandleCloudEventErrorOptions & {
    type: CloudEventErrorType.Eventarc;
    eventType: string;
  };

function getContext(
  options:
    | HandleCloudEventPubSubErrorOptions
    | HandleCloudEventEventarcErrorOptions,
): string {
  switch (options.type) {
    case CloudEventErrorType.PubSub: {
      return `PubSub - ${options.topic}`;
    }
    case CloudEventErrorType.Eventarc: {
      return `Eventarc - ${options.eventType}`;
    }
    default: {
      return 'Unknown';
    }
  }
}

export async function handleCloudEventError(
  options:
    | HandleCloudEventPubSubErrorOptions
    | HandleCloudEventEventarcErrorOptions,
): Promise<void> {
  const context = getContext(options);
  const diff = dayjs().diff(dayjs(options.event.time), 'ms');
  if (options.error instanceof RetryEvent && diff > RETRY_EVENT_MAX_DIFF) {
    Logger.log(`[${context}] allowing retry`);
    throw options.error;
  }
  const { error: unparsedError, app, ...optionsRest } = options;
  const errorJson = removeCircular(unparsedError);
  Logger.error(
    `[${context}] Has an error: ${JSON.stringify({
      error: errorJson,
      errorString: String(unparsedError),
    })}`,
  );
  const [, traceId] = safe(() => getTraceId());
  const [, correlationId] = safe(() => getCorrelationId());
  const [errorFirestore] = await safeAsync(async () => {
    const isException = unparsedError instanceof Exception;
    const error = isException ? unparsedError : UNKNOWN_INTERNAL_SERVER_ERROR();
    const firestore = app.get(FirebaseAdminFirestore);
    const originalError = isException
      ? undefined
      : {
          json: JSON.stringify(errorJson),
          string: String(unparsedError),
        };
    await firestore
      .collection('event-errors')
      .doc()
      .create({
        traceId,
        correlationId,
        error: error.toJSON(),
        originalError,
        date: new Date(),
        isException,
        ttl: dayjs().add(14, 'day').toDate(),
        ...optionsRest,
      });
  });
  if (!errorFirestore) {
    return;
  }
  Logger.error(
    `[${context}] Error trying to register event error: ${JSON.stringify({
      error: removeCircular(errorFirestore),
      errorString: String(errorFirestore),
    })}`,
  );
}
