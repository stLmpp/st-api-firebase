import { INestApplicationContext, Logger } from '@nestjs/common';
import {
  Exception,
  getCorrelationId,
  getTraceId,
  safe,
  safeAsync,
  UNKNOWN_INTERNAL_SERVER_ERROR,
} from '@st-api/core';

import { FirebaseAdminFirestore } from '../firebase-admin/firebase-admin-firestore.js';

import { removeCircular } from './remove-circular.js';

export enum CloudEventErrorType {
  Eventarc = 'Eventarc',
  PubSub = 'PubSub',
}

export interface HandleCloudEventErrorOptions {
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
