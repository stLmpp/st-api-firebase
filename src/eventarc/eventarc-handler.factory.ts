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
import { ZodSchema } from 'zod';

import { getTraceIdFromEvent } from '../common/get-trace-id-from-event.js';
import {
  CloudEventErrorType,
  handleCloudEventError,
} from '../common/handle-cloud-event-error.js';
import { APP_SYMBOL } from '../common/inject.js';
import { EVENT_BAD_FORMAT, EVENT_BAD_REQUEST } from '../exceptions.js';

import { EventarcData } from './eventarc-data.schema.js';

export type EventarcHandlerOptions<
  EventType extends string,
  Schema extends ZodSchema,
> = {
  eventType: EventType;
  schema: () => Promise<Schema> | Schema;
  handle: (event: Schema) => Promise<void> | void;
} & Pick<EventarcTriggerOptions, 'eventFilters' | 'eventFilterPathPatterns'>;

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
            throw EVENT_BAD_FORMAT(formatZodErrorString(eventDataResult.error));
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
              const json = eventDataResult.data;
              const result = await schema.safeParseAsync(json);
              if (!result.success) {
                throw EVENT_BAD_REQUEST(formatZodErrorString(result.error));
              }
              await eventOptions.handle(result.data);
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
}
