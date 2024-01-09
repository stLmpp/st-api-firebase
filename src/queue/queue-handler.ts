import { INestApplicationContext, Logger } from '@nestjs/common';
import {
  apiStateRunInContext,
  createCorrelationId,
  Exception,
  formatZodErrorString,
  getStateKey,
  safeAsync,
  UNKNOWN_INTERNAL_SERVER_ERROR,
} from '@st-api/core';
import { CloudEvent, CloudFunction } from 'firebase-functions/v2';
import {
  MessagePublishedData,
  onMessagePublished,
  PubSubOptions,
} from 'firebase-functions/v2/pubsub';
import { Class } from 'type-fest';
import { z, ZodSchema } from 'zod';

import { QUEUE_BAD_REQUEST } from '../exceptions.js';
import { FirebaseAdminFirestore } from '../firebase-admin-firestore.js';

import {
  QUEUE_CORRELATION_ID_ATTR_KEY,
  QUEUE_TRACE_ID_ATTR_KEY,
} from './constants.js';

const APP_SYMBOL = Symbol('APP_SYMBOL');

export function queueInject<T>(type: Class<T>): T {
  const app = getStateKey(APP_SYMBOL) as INestApplicationContext | undefined;
  if (!app) {
    throw new Error('App is not running on context');
  }
  return app.get(type);
}

interface EventData<T extends ZodSchema> {
  data: z.infer<T>;
  attributes: Record<string, string>;
}

export interface Queue<
  Topic extends string = string,
  Schema extends ZodSchema = ZodSchema,
> {
  topic: Topic;
  schema: () => Promise<Schema> | Schema;
  handle: (event: EventData<Schema>) => Promise<void> | void;
}

export interface CreateQueueHandler {
  <T extends ZodSchema>(
    queue: Queue<string, T>,
  ): CloudFunction<CloudEvent<MessagePublishedData>>;
}

function getTraceIdFromEvent(event: CloudEvent<unknown>): string | undefined {
  if ('traceparent' in event && typeof event.traceparent === 'string') {
    return event.traceparent.split('-')[1];
  }
}

export function queueHandlerFactory(
  appGetter: () => Promise<INestApplicationContext>,
  options: Omit<PubSubOptions, 'topic'>,
): CreateQueueHandler {
  return <T extends ZodSchema>(queue: Queue<string, T>) => {
    let schema: T | undefined;
    return onMessagePublished(
      {
        ...options,
        topic: queue.topic,
      },
      async (event) => {
        const eventTraceId = getTraceIdFromEvent(event);
        const app = await appGetter();
        const [unparsedError] = await safeAsync(async () => {
          const attributes = event.data.message.attributes;
          attributes[QUEUE_CORRELATION_ID_ATTR_KEY] ??= createCorrelationId();
          attributes[QUEUE_TRACE_ID_ATTR_KEY] ??=
            eventTraceId ?? createCorrelationId();
          await apiStateRunInContext(
            async () => {
              schema ??= await queue.schema();
              const json = event.data.message.json;
              const result = await schema.safeParseAsync(json);
              if (!result.success) {
                throw QUEUE_BAD_REQUEST(formatZodErrorString(result.error));
              }
              await queue.handle({
                attributes,
                data: result.data,
              });
            },
            {
              [APP_SYMBOL]: app,
              correlationId: attributes[QUEUE_CORRELATION_ID_ATTR_KEY],
              traceId: attributes[QUEUE_TRACE_ID_ATTR_KEY],
            },
          );
        });
        if (!unparsedError) {
          return;
        }
        Logger.error(
          `[${queue.topic}] Queue has an error: ${JSON.stringify({
            error: unparsedError,
            errorString: String(unparsedError),
          })}`,
        );
        const [errorFirestore] = await safeAsync(async () => {
          const error =
            unparsedError instanceof Exception
              ? unparsedError
              : UNKNOWN_INTERNAL_SERVER_ERROR();
          const firestore = app.get(FirebaseAdminFirestore);
          await firestore.collection('queue-errors').doc().create({
            topic: queue.topic,
            error: error.toJSON(),
            data: new Date(),
          });
        });
        if (!errorFirestore) {
          return;
        }
        Logger.error(
          `[${
            queue.topic
          }] Error trying to register queue error: ${JSON.stringify({
            error: errorFirestore,
            errorString: String(errorFirestore),
          })}`,
        );
      },
    );
  };
}
