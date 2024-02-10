import { INestApplicationContext } from '@nestjs/common';
import {
  apiStateRunInContext,
  createCorrelationId,
  formatZodErrorString,
  safeAsync,
} from '@st-api/core';
import { CloudEvent, CloudFunction } from 'firebase-functions/v2';
import {
  EventarcTriggerOptions,
  onCustomEventPublished,
} from 'firebase-functions/v2/eventarc';
import { Class } from 'type-fest';
import { z, ZodSchema } from 'zod';

import { getTraceIdFromEvent } from '../common/get-trace-id-from-event.js';
import {
  CloudEventErrorType,
  handleCloudEventError,
} from '../common/handle-cloud-event-error.js';
import { APP_SYMBOL } from '../common/inject.js';
import {
  EVENTARC_BAD_FORMAT,
  EVENTARC_BAD_REQUEST,
  EVENTARC_INVALID_HANDLER,
} from '../exceptions.js';
import { Logger } from '../logger.js';

import { EventarcData } from './eventarc-data.schema.js';

export type EventarcHandle<Schema extends ZodSchema> = (
  event: z.infer<Schema>,
) => Promise<void> | void;
export interface EventarcHandler<Schema extends ZodSchema> {
  handle: EventarcHandle<Schema>;
}
export type EventarcHandlers<Schema extends ZodSchema> =
  | { handle: EventarcHandle<Schema> }
  | { handler: Class<EventarcHandler<Schema>> };

export type EventarcHandlerOptions<
  EventType extends string,
  Schema extends ZodSchema,
> = {
  eventType: EventType;
  schema: () => Promise<Schema> | Schema;
} & Pick<EventarcTriggerOptions, 'eventFilters' | 'eventFilterPathPatterns'> &
  EventarcHandlers<Schema>;

export type EventarcHandlerFactoryOptions = Omit<
  EventarcTriggerOptions,
  'eventType' | 'eventFilters' | 'eventFilterPathPatterns'
>;

export class EventarcHandlerFactory {
  constructor(
    private readonly options: EventarcHandlerFactoryOptions,
    private readonly getApp: () => Promise<INestApplicationContext>,
  ) {}

  create<EventType extends string, Schema extends ZodSchema>(
    eventOptions: EventarcHandlerOptions<EventType, Schema>,
  ): CloudFunction<CloudEvent<unknown>> {
    let schema: Schema | undefined;
    let handle: EventarcHandle<Schema> | undefined;
    return onCustomEventPublished(
      {
        eventType: eventOptions.eventType,
        eventFilters: eventOptions.eventFilters,
        eventFilterPathPatterns: eventOptions.eventFilterPathPatterns,
        ...this.options,
      },
      async (event) => {
        const app = await this.getApp();
        const [unparsedError] = await safeAsync(async () => {
          const eventDataResult = EventarcData.safeParse(event.data);
          if (!eventDataResult.success) {
            throw EVENTARC_BAD_FORMAT(
              formatZodErrorString(eventDataResult.error),
            );
          }
          const correlationId =
            eventDataResult.data.correlationId ?? createCorrelationId();
          const traceId =
            eventDataResult.data.traceId ??
            getTraceIdFromEvent(event) ??
            createCorrelationId();
          await apiStateRunInContext(
            async () => {
              schema ??= await eventOptions.schema();
              handle ??= await this.getHandle(eventOptions, app);
              const json = eventDataResult.data;
              const result = await schema.safeParseAsync(json);
              if (!result.success) {
                throw EVENTARC_BAD_REQUEST(formatZodErrorString(result.error));
              }
              await handle(result.data);
            },
            {
              [APP_SYMBOL]: app,
              correlationId,
              traceId,
            },
          );
        });
        if (!unparsedError) {
          return;
        }
        // TODO allow retry in some cases
        await handleCloudEventError({
          type: CloudEventErrorType.Eventarc,
          error: unparsedError,
          app,
          eventType: eventOptions.eventType,
          data: event.data,
        });
      },
    );
  }

  private async getHandle<Schema extends ZodSchema, EventType extends string>(
    options: EventarcHandlerOptions<EventType, Schema>,
    app: INestApplicationContext,
  ): Promise<EventarcHandle<Schema>> {
    if ('handle' in options) {
      return options.handle;
    }
    const [error, handler] = await safeAsync(() =>
      app.resolve(options.handler),
    );
    if (error) {
      Logger.error(
        `[Eventarc] Could not find instance of ${options.handler.name}, ` +
          `make sure it is registered in the module providers`,
        error,
      );
      throw EVENTARC_INVALID_HANDLER(error.message);
    }
    return (...args) => handler.handle(...args);
  }
}

export function createEventarcHandler<
  EventType extends string,
  Schema extends ZodSchema,
>(
  options: EventarcHandlerOptions<EventType, Schema>,
): EventarcHandlerOptions<EventType, Schema> {
  return options;
}
