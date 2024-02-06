import { INestApplicationContext } from '@nestjs/common';
import {
  apiStateRunInContext,
  createCorrelationId,
  formatZodErrorString,
  safeAsync,
} from '@st-api/core';
import { CloudEvent, CloudFunction } from 'firebase-functions/v2';
import {
  onMessagePublished,
  PubSubOptions,
} from 'firebase-functions/v2/pubsub';
import { z, ZodSchema } from 'zod';

import { CORRELATION_ID_KEY, TRACE_ID_KEY } from '../common/constants.js';
import { getTraceIdFromEvent } from '../common/get-trace-id-from-event.js';
import {
  CloudEventErrorType,
  handleCloudEventError,
} from '../common/handle-cloud-event-error.js';
import { APP_SYMBOL } from '../common/inject.js';
import { QUEUE_BAD_REQUEST } from '../exceptions.js';

export type PubSubHandlerFactoryOptions = Omit<PubSubOptions, 'topic'>;

export interface PubSubEventData<T extends ZodSchema> {
  data: z.infer<T>;
  attributes: Record<string, string>;
}

export interface PubSubHandlerOptions<
  Topic extends string = string,
  Schema extends ZodSchema = ZodSchema,
> {
  topic: Topic;
  schema: () => Promise<Schema> | Schema;
  handle: (event: PubSubEventData<Schema>) => Promise<void> | void;
}

export class PubSubHandlerFactory {
  constructor(
    private readonly options: PubSubHandlerFactoryOptions,
    private readonly getApp: () => Promise<INestApplicationContext>,
  ) {}

  create<Topic extends string, Schema extends ZodSchema>(
    options: PubSubHandlerOptions<Topic, Schema>,
  ): CloudFunction<CloudEvent<unknown>> {
    let schema: Schema | undefined;
    return onMessagePublished(
      {
        ...this.options,
        topic: options.topic,
      },
      async (event) => {
        const eventTraceId = getTraceIdFromEvent(event);
        const app = await this.getApp();
        const [unparsedError] = await safeAsync(async () => {
          const attributes = event.data.message.attributes;
          attributes[CORRELATION_ID_KEY] ??= createCorrelationId();
          attributes[TRACE_ID_KEY] ??= eventTraceId ?? createCorrelationId();
          await apiStateRunInContext(
            async () => {
              schema ??= await options.schema();
              const json = event.data.message.json;
              const result = await schema.safeParseAsync(json);
              if (!result.success) {
                throw QUEUE_BAD_REQUEST(formatZodErrorString(result.error));
              }
              await options.handle({
                attributes,
                data: result.data,
              });
            },
            {
              [APP_SYMBOL]: app,
              correlationId: attributes[CORRELATION_ID_KEY],
              traceId: attributes[TRACE_ID_KEY],
            },
          );
        });
        if (!unparsedError) {
          return;
        }
        await handleCloudEventError({
          app,
          error: unparsedError,
          type: CloudEventErrorType.PubSub,
          topic: options.topic,
        });
      },
    );
  }
}
