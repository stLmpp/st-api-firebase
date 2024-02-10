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
import { Class } from 'type-fest';
import { z, ZodSchema } from 'zod';

import { CORRELATION_ID_KEY, TRACE_ID_KEY } from '../common/constants.js';
import { getTraceIdFromEvent } from '../common/get-trace-id-from-event.js';
import {
  CloudEventErrorType,
  handleCloudEventError,
} from '../common/handle-cloud-event-error.js';
import { APP_SYMBOL } from '../common/inject.js';
import { PUB_SUB_BAD_REQUEST, PUB_SUB_INVALID_HANDLER } from '../exceptions.js';
import { Logger } from '../logger.js';

export type PubSubHandlerFactoryOptions = Omit<PubSubOptions, 'topic'>;

export interface PubSubEventData<Schema extends ZodSchema> {
  data: z.infer<Schema>;
  attributes: Record<string, string>;
}

export type PubSubHandle<Schema extends ZodSchema> = (
  event: PubSubEventData<Schema>,
) => Promise<void> | void;

export interface PubSubHandler<Schema extends ZodSchema> {
  handle: PubSubHandle<Schema>;
}

type PubSubHandlers<Schema extends ZodSchema> =
  | { handle: PubSubHandle<Schema> }
  | { handler: Class<PubSubHandler<Schema>> };

export type PubSubHandlerOptions<
  Topic extends string = string,
  Schema extends ZodSchema = ZodSchema,
> = {
  topic: Topic;
  schema: () => Promise<Schema> | Schema;
} & PubSubHandlers<Schema>;

export class PubSubHandlerFactory {
  constructor(
    private readonly options: PubSubHandlerFactoryOptions,
    private readonly getApp: () => Promise<INestApplicationContext>,
  ) {}

  create<Topic extends string, Schema extends ZodSchema>(
    options: PubSubHandlerOptions<Topic, Schema>,
  ): CloudFunction<CloudEvent<unknown>> {
    let schema: Schema | undefined;
    let handle: PubSubHandle<Schema>;
    return onMessagePublished(
      {
        ...this.options,
        topic: options.topic,
      },
      async (event) => {
        const eventTraceId = getTraceIdFromEvent(event);
        const app = await this.getApp();
        const [unparsedError] = await safeAsync(async () => {
          handle ??= await this.getHandle(options, app);
          const attributes = event.data.message.attributes;
          attributes[CORRELATION_ID_KEY] ??= createCorrelationId();
          attributes[TRACE_ID_KEY] ??= eventTraceId ?? createCorrelationId();
          await apiStateRunInContext(
            async () => {
              schema ??= await options.schema();
              const json = event.data.message.json;
              const result = await schema.safeParseAsync(json);
              if (!result.success) {
                throw PUB_SUB_BAD_REQUEST(formatZodErrorString(result.error));
              }
              await handle({
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
        // TODO allow retry
        await handleCloudEventError({
          app,
          error: unparsedError,
          type: CloudEventErrorType.PubSub,
          topic: options.topic,
          data: {
            attributes: event.data.message.attributes,
            json: event.data.message.json,
          },
        });
      },
    );
  }

  private async getHandle<Schema extends ZodSchema, Topic extends string>(
    options: PubSubHandlerOptions<Topic, Schema>,
    app: INestApplicationContext,
  ): Promise<PubSubHandle<Schema>> {
    if ('handle' in options) {
      return options.handle;
    }
    const [error, handler] = await safeAsync(() =>
      app.resolve(options.handler),
    );
    if (error) {
      Logger.error(
        `[PubSub] Could not find instance of ${options.handler.name}, ` +
          `make sure it is registered in the module providers`,
        error,
      );
      throw PUB_SUB_INVALID_HANDLER(error.message);
    }
    return (...args) => handler.handle(...args);
  }
}

export function createPubSubHandler<
  Topic extends string,
  Schema extends ZodSchema,
>(
  options: PubSubHandlerOptions<Topic, Schema>,
): PubSubHandlerOptions<Topic, Schema> {
  return options;
}
