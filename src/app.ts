import {
  BlockingFunction,
  CloudFunction as CloudFunctionV1,
} from 'firebase-functions/v1';
import { CloudEvent, CloudFunction } from 'firebase-functions/v2';
import { HttpsFunction, onRequest } from 'firebase-functions/v2/https';
import { ZodSchema } from 'zod';

import {
  DefaultFirebaseAppNamingStrategy,
  StFirebaseAppNamingStrategy,
} from './app-naming-strategy.js';
import {
  StFirebaseAppAdapter,
  StFirebaseAppDefaultAdapter,
} from './app.adapter.js';
import {
  StFirebaseAppCustomEventContext,
  StFirebaseAppHttpOptions,
  StFirebaseAppOptions,
  StFirebaseAppOptionsExtended,
  StFirebaseAppRecord,
} from './app.type.js';
import {
  CallableHandlerFactory,
  CallableHandlerOptions,
} from './callable/callable-handler.factory.js';
import { isEmulator } from './common/is-emulator.js';
import { CustomEventHandlerFactory } from './custom-event/custom-event-handler.factory.js';
import {
  CONCURRENCY,
  MAX_INSTANCES,
  MEMORY,
  TIMEOUT_SECONDS,
  USE_GEN1_CPU,
} from './env-variables.js';
import {
  EventarcHandlerFactory,
  EventarcHandlerFactoryOptions,
  EventarcHandlerOptions,
} from './eventarc/eventarc-handler.factory.js';
import { Logger } from './logger.js';
import { mergeAppOptions } from './merge-app-options.js';
import {
  PubSubHandlerFactory,
  PubSubHandlerFactoryOptions,
  PubSubHandlerOptions,
} from './pub-sub/pub-sub-handler.factory.js';
import { createHonoApp, HonoApp } from '@st-api/core';
import { Hono } from 'hono';
import { TRACE_ID_HEADER } from './common/constants.js';
import {
  EVENTARC_PUBLISH_ERROR,
  FUNCTION_CALL_INVALID_RESPONSE,
  FUNCTION_CALL_UNKNOWN_ERROR,
  PUB_SUB_PUBLISH_ERROR,
} from './exceptions.js';
import { loggerMiddleware } from './logger.middleware.js';
import { expressToHonoAdapter } from './express-to-hono.adapter.js';

export class StFirebaseApp {
  private constructor(options: StFirebaseAppOptions) {
    this.adapter = options.adapter ?? new StFirebaseAppDefaultAdapter();
    const newOptions = mergeAppOptions(
      options,
      this.adapter.options ?? { controllers: [] },
    );
    this.options = {
      retry: false,
      preserveExternalChanges: true,
      ...newOptions,
      ...newOptions.handlerOptions,
      timeoutSeconds: TIMEOUT_SECONDS,
      concurrency: CONCURRENCY,
      cpu: USE_GEN1_CPU.value() ? 'gcf_gen1' : undefined,
      maxInstances: MAX_INSTANCES,
      secrets: newOptions.secrets ?? [],
      memory: MEMORY,
      minInstances: 0,
    };
    this.namingStrategy =
      newOptions?.namingStrategy ?? new DefaultFirebaseAppNamingStrategy();
    const commonOptions:
      | EventarcHandlerFactoryOptions
      | PubSubHandlerFactoryOptions = {
      retry: this.options.retry,
      preserveExternalChanges: this.options.preserveExternalChanges,
      timeoutSeconds: this.options.timeoutSeconds,
      concurrency: this.options.concurrency,
      cpu: this.options.cpu,
      maxInstances: this.options.maxInstances,
      secrets: this.options.secrets,
      memory: this.options.memory,
      minInstances: this.options.minInstances,
      region: this.options.region,
    };
    this.eventarcHandlerFactory = new EventarcHandlerFactory(
      commonOptions,
      () => this.getApp(),
      this.adapter.eventarcMiddleware.bind(this.adapter),
    );
    this.pubSubHandlerFactory = new PubSubHandlerFactory(
      commonOptions,
      () => this.getApp(),
      this.adapter.pubSubMiddleware.bind(this.adapter),
    );
    this.callableHandlerFactory = new CallableHandlerFactory(
      commonOptions,
      () => this.getApp(),
      this.adapter.callableMiddleware.bind(this.adapter),
    );
    this.customEventHandlerFactory = new CustomEventHandlerFactory(
      this.options,
      () => this.getApp(),
    );
  }

  static create(options: StFirebaseAppOptions): StFirebaseApp {
    return new StFirebaseApp(options);
  }

  private readonly options: StFirebaseAppOptionsExtended;
  private readonly logger = Logger.create(this);
  private readonly eventarcHandlerFactory: EventarcHandlerFactory;
  private readonly pubSubHandlerFactory: PubSubHandlerFactory;
  private readonly callableHandlerFactory: CallableHandlerFactory;
  private readonly customEventHandlerFactory: CustomEventHandlerFactory;
  private readonly cloudEvents: StFirebaseAppRecord = {};
  private readonly callables: Record<string, CallableFunction> = {};
  private readonly adapter: StFirebaseAppAdapter;
  private readonly namingStrategy: StFirebaseAppNamingStrategy;
  private app: HonoApp<Hono> | undefined;
  private hasHttpHandler = false;

  withHttpHandler(): this {
    this.hasHttpHandler = true;
    return this;
  }

  getHttpHandler(
    options: StFirebaseAppHttpOptions = {},
  ): HttpsFunction | undefined {
    return onRequest(
      {
        secrets: this.options.secrets,
        maxInstances: this.options.maxInstances,
        memory: this.options.memory,
        minInstances: this.options.minInstances,
        timeoutSeconds: this.options.timeoutSeconds,
        concurrency: this.options.concurrency,
        cpu: this.options.cpu,
        preserveExternalChanges: this.options.preserveExternalChanges,
        omit: !this.hasHttpHandler && !isEmulator(),
        region: this.options.region,
        ...options,
      },
      async (req, res) => {
        const app = await this.getApp();
        await expressToHonoAdapter(app.hono, req, res);
      },
    );
  }

  getCloudEventHandlers(): StFirebaseAppRecord {
    return this.cloudEvents;
  }

  getCallableHandlers(): Record<string, CallableFunction> {
    return this.callables;
  }

  addCallable<
    RequestSchema extends ZodSchema,
    ResponseSchema extends ZodSchema,
  >(options: CallableHandlerOptions<RequestSchema, ResponseSchema>): this {
    const key = this.namingStrategy.callable(options.name);
    this.callables[key] = this.callableHandlerFactory.create(options);
    return this;
  }

  addPubSub<Topic extends string, Schema extends ZodSchema>(
    options: PubSubHandlerOptions<Topic, Schema>,
  ): this {
    const key = this.namingStrategy.pubSub(options.topic);
    this.cloudEvents[key] = this.pubSubHandlerFactory.create(options);
    return this;
  }

  addEventarc<EventType extends string, Schema extends ZodSchema>(
    event: EventarcHandlerOptions<EventType, Schema>,
  ): this {
    const key = this.namingStrategy.eventarc(event.eventType);
    this.cloudEvents[key] = this.eventarcHandlerFactory.create(event);
    return this;
  }

  addCustomEvent(
    name: string,
    callback: (
      context: StFirebaseAppCustomEventContext,
    ) =>
      | CloudFunction<CloudEvent<unknown>>
      | CloudFunctionV1<any>
      | BlockingFunction,
  ): this {
    const key = this.namingStrategy.custom();
    this.cloudEvents[key] = this.customEventHandlerFactory.create(
      name,
      callback,
    );
    return this;
  }

  async getApp(): Promise<HonoApp<Hono>> {
    if (this.app) {
      return this.app;
    }
    const hono = new Hono().use(loggerMiddleware(this.logger));
    const app = await createHonoApp({
      hono,
      controllers: this.options.controllers,
      swaggerDocumentBuilder: this.options.swaggerDocumentBuilder,
      providers: this.options.providers,
      getTraceId: (request) => {
        const traceId =
          request.header(TRACE_ID_HEADER) ||
          request.header(TRACE_ID_HEADER.toLowerCase());
        if (!traceId) {
          return;
        }
        return traceId.split('/').at(0);
      },
      getCorrelationId: this.options.getCorrelationId,
      getExecutionId: this.options.getExecutionId,
      extraGlobalExceptions: [
        ...(this.options?.extraGlobalExceptions ?? []),
        PUB_SUB_PUBLISH_ERROR,
        EVENTARC_PUBLISH_ERROR,
        FUNCTION_CALL_UNKNOWN_ERROR,
        FUNCTION_CALL_INVALID_RESPONSE,
      ],
      cors: this.options.cors,
    });
    return (this.app = app);
  }
}
