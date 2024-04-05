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
) => Promise<void>;
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
} & Pick<
  EventarcTriggerOptions,
  | 'eventFilters'
  | 'eventFilterPathPatterns'
  | 'retry'
  | 'preserveExternalChanges'
> &
  EventarcHandlers<Schema>;

export type EventarcHandlerFactoryOptions = Omit<
  EventarcTriggerOptions,
  'eventType' | 'eventFilters' | 'eventFilterPathPatterns'
>;

interface HandleCloudEventOptions<
  EventType extends string = string,
  Schema extends ZodSchema = ZodSchema,
> {
  event: CloudEvent<unknown>;
  options: EventarcHandlerOptions<EventType, Schema>;
  app: INestApplicationContext;
  getHandle(): Promise<EventarcHandle<Schema>>;
  getSchema(): Promise<Schema>;
}

export class EventarcHandlerFactory {
  constructor(
    private readonly options: EventarcHandlerFactoryOptions,
    private readonly getApp: () => Promise<INestApplicationContext>,
  ) {}

  create<EventType extends string, Schema extends ZodSchema>(
    options: EventarcHandlerOptions<EventType, Schema>,
  ): CloudFunction<CloudEvent<unknown>> {
    let schema: Schema | undefined;
    let handle: EventarcHandle<Schema> | undefined;
    const getSchema = async () => (schema ??= await options.schema());
    return onCustomEventPublished(
      {
        eventType: options.eventType,
        eventFilters: options.eventFilters,
        eventFilterPathPatterns: options.eventFilterPathPatterns,
        ...this.options,
      },
      async (event) => {
        const app = await this.getApp();
        const getHandle = async () =>
          (handle ??= await this.getHandle(options, app));
        await this.handleCloudEvent({
          app,
          options,
          event,
          getSchema,
          getHandle,
        });
      },
    );
  }

  private async handleCloudEvent<
    EventType extends string,
    Schema extends ZodSchema,
  >({
    options,
    app,
    event,
    getSchema,
    getHandle,
  }: HandleCloudEventOptions<EventType, Schema>) {
    const eventDataResult = EventarcData.safeParse(event.data);
    const dataResult = eventDataResult.success
      ? eventDataResult.data
      : undefined;
    const correlationId = dataResult?.correlationId ?? createCorrelationId();
    const traceId =
      dataResult?.traceId ??
      getTraceIdFromEvent(event) ??
      createCorrelationId();
    await apiStateRunInContext(
      async () => {
        const [unparsedError] = await safeAsync(async () => {
          if (!eventDataResult.success) {
            throw EVENTARC_BAD_FORMAT(
              formatZodErrorString(eventDataResult.error),
            );
          }
          const schema = await getSchema();
          const handle = await getHandle();
          const json = eventDataResult.data.body;
          const result = await schema.safeParseAsync(json);
          if (!result.success) {
            throw EVENTARC_BAD_REQUEST(formatZodErrorString(result.error));
          }
          await handle(result.data);
        });
        if (!unparsedError) {
          return;
        }
        await handleCloudEventError({
          event,
          type: CloudEventErrorType.Eventarc,
          error: unparsedError,
          app,
          eventType: options.eventType,
          data: event.data,
        });
      },
      {
        [APP_SYMBOL]: app,
        correlationId,
        traceId,
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
