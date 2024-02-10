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

export type HandleCloudEventQueueErrorOptions = HandleCloudEventErrorOptions & {
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
    | HandleCloudEventQueueErrorOptions
    | HandleCloudEventEventarcErrorOptions,
): string {
  switch (options.type) {
    case CloudEventErrorType.PubSub: {
      return `Queue - ${options.topic}`;
    }
    case CloudEventErrorType.Eventarc: {
      return `Event - ${options.eventType}`;
    }
    default: {
      return 'Unknown';
    }
  }
}

export async function handleCloudEventError(
  options:
    | HandleCloudEventQueueErrorOptions
    | HandleCloudEventEventarcErrorOptions,
): Promise<void> {
  const context = getContext(options);
  const { error: unparsedError, app, ...optionsRest } = options;
  Logger.error(
    `[${context}] Has an error: ${JSON.stringify({
      error: unparsedError,
      errorString: String(unparsedError),
    })}`,
  );
  const [, traceId] = safe(() => getTraceId());
  const [, correlationId] = safe(() => getCorrelationId());
  const [errorFirestore] = await safeAsync(async () => {
    const error =
      unparsedError instanceof Exception
        ? unparsedError
        : UNKNOWN_INTERNAL_SERVER_ERROR();
    const firestore = app.get(FirebaseAdminFirestore);
    await firestore
      .collection('event-errors')
      .doc()
      .create({
        traceId,
        correlationId,
        error: error.toJSON(),
        date: new Date(),
        ...optionsRest,
      });
  });
  if (!errorFirestore) {
    return;
  }
  Logger.error(
    `[${context}] Error trying to register event error: ${JSON.stringify({
      error: errorFirestore,
      errorString: String(errorFirestore),
    })}`,
  );
}
