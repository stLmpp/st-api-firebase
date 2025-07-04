import {
  apiStateRunInContext,
  createCorrelationId,
  formatZodErrorString,
  HonoApp,
  safeAsync,
} from '@st-api/core';
import { CloudEvent, CloudFunction } from 'firebase-functions/v2';
import {
  EventarcTriggerOptions,
  onCustomEventPublished,
} from 'firebase-functions/v2/eventarc';
import { Class } from 'type-fest';
import { z, ZodSchema } from 'zod';

import { StFirebaseAppEventarcMiddleware } from '../app.adapter.js';
import { CloudEventType } from '../cloud-event-type.enum.js';
import { getTraceIdFromEvent } from '../common/get-trace-id-from-event.js';
import { handleCloudEventError } from '../common/handle-cloud-event-error.js';
import { APP_SYMBOL } from '../common/inject.js';
import {
  EVENTARC_BAD_FORMAT,
  EVENTARC_BAD_REQUEST,
  EVENTARC_INVALID_HANDLER,
} from '../exceptions.js';
import { Logger } from '../logger.js';

import { EventarcData } from './eventarc-data.schema.js';
import { Hono } from 'hono';

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
  EventType extends string = string,
  Schema extends ZodSchema = ZodSchema,
> = {
  eventType: EventType;
  schema: () => Promise<Schema> | Schema;
} & Pick<
  EventarcTriggerOptions,
  | 'eventFilters'
  | 'eventFilterPathPatterns'
  | 'retry'
  | 'preserveExternalChanges'
  | 'region'
  | 'timeoutSeconds'
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
  app: HonoApp<Hono>;
  getHandle(this: void): Promise<EventarcHandle<Schema>>;
  getSchema(this: void): Promise<Schema>;
}

export class EventarcHandlerFactory {
  constructor(
    private readonly options: EventarcHandlerFactoryOptions,
    private readonly getApp: () => Promise<HonoApp<Hono>>,
    private readonly middleware: StFirebaseAppEventarcMiddleware,
  ) {}

  create<EventType extends string, Schema extends ZodSchema>(
    options: EventarcHandlerOptions<EventType, Schema>,
  ): CloudFunction<CloudEvent<unknown>> {
    let schema: Schema | undefined;
    let handle: EventarcHandle<Schema> | undefined;
    const getSchema = async () => (schema ??= await options.schema());
    return onCustomEventPublished(
      {
        ...this.options,
        eventType: options.eventType,
        eventFilters: options.eventFilters,
        eventFilterPathPatterns: options.eventFilterPathPatterns,
        preserveExternalChanges:
          options.preserveExternalChanges ??
          this.options.preserveExternalChanges,
        retry: options.retry ?? this.options.retry,
        region: options.region ?? this.options.region,
        timeoutSeconds: options.timeoutSeconds ?? this.options.timeoutSeconds,
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
        Logger.debug(
          `[Eventarc - ${options.eventType}] Event received (before middleware)`,
          { event },
        );
        event = await this.middleware(event);
        Logger.debug(
          `[Eventarc - ${options.eventType}] Event received (after middleware)`,
          { event },
        );
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
          type: CloudEventType.Eventarc,
          error: unparsedError,
          app,
          eventType: options.eventType,
          data: event.data,
          eventTimestamp: event.time,
        });
      },
      {
        metadata: {
          [APP_SYMBOL]: app,
        },
        correlationId,
        traceId,
        executionId: event.id || undefined,
      },
    );
  }

  private async getHandle<Schema extends ZodSchema, EventType extends string>(
    options: EventarcHandlerOptions<EventType, Schema>,
    app: HonoApp<Hono>,
  ): Promise<EventarcHandle<Schema>> {
    if ('handle' in options) {
      return options.handle;
    }
    const [error, handler] = await safeAsync(() =>
      app.injector.resolve(options.handler),
    );
    if (error) {
      Logger.error(
        `[Eventarc] Could not find instance of ${options.handler.name}, ` +
          `make sure it is registered in the providers`,
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
