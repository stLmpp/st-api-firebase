import { INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { configureApp } from '@st-api/core';
import express, { Express } from 'express';
import { CloudFunction as CloudFunctionV1 } from 'firebase-functions';
import { CloudEvent, CloudFunction } from 'firebase-functions/v2';
import { HttpsFunction, onRequest } from 'firebase-functions/v2/https';
import { Class } from 'type-fest';
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
import { TRACE_ID_HEADER } from './common/constants.js';
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
import {
  EVENTARC_PUBLISH_ERROR,
  FUNCTION_CALL_INVALID_RESPONSE,
  FUNCTION_CALL_UNKNOWN_ERROR,
  PUB_SUB_PUBLISH_ERROR,
} from './exceptions.js';
import { Logger } from './logger.js';
import { LoggerMiddleware } from './logger.middleware.js';
import { mergeAppOptions } from './merge-app-options.js';
import {
  PubSubHandlerFactory,
  PubSubHandlerFactoryOptions,
  PubSubHandlerOptions,
} from './pub-sub/pub-sub-handler.factory.js';

export class StFirebaseApp {
  private constructor(
    private readonly appModule: Class<any>,
    options?: StFirebaseAppOptions,
  ) {
    this.adapter = options?.adapter ?? new StFirebaseAppDefaultAdapter();
    const newOptions = mergeAppOptions(
      options ?? {},
      this.adapter.options ?? {},
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
    };
    this.eventarcHandlerFactory = new EventarcHandlerFactory(
      commonOptions,
      () => this.getAppContext(),
      this.adapter.eventarcMiddleware.bind(this.adapter),
    );
    this.pubSubHandlerFactory = new PubSubHandlerFactory(
      commonOptions,
      () => this.getAppContext(),
      this.adapter.pubSubMiddleware.bind(this.adapter),
    );
    this.callableHandlerFactory = new CallableHandlerFactory(
      commonOptions,
      () => this.getAppContext(),
      this.adapter.callableMiddleware.bind(this.adapter),
    );
    this.customEventHandlerFactory = new CustomEventHandlerFactory(
      this.options,
      () => this.getAppContext(),
    );
  }

  static create(
    appModule: Class<any>,
    options?: StFirebaseAppOptions,
  ): StFirebaseApp {
    return new StFirebaseApp(appModule, options);
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
  private apps: [INestApplication, Express] | undefined;
  private appContext: INestApplicationContext | undefined;
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
        ...options,
      },
      async (request, response) => {
        const [, app] = await this.getApp();
        return app(request, response);
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
    ) => CloudFunction<CloudEvent<unknown>> | CloudFunctionV1<any>,
  ): this {
    const key = this.namingStrategy.custom();
    this.cloudEvents[key] = this.customEventHandlerFactory.create(
      name,
      callback,
    );
    return this;
  }

  async getApp(): Promise<[nest: INestApplication, express: Express]> {
    if (this.apps) {
      return this.apps;
    }
    const expressApp = express();
    const app = configureApp(
      await NestFactory.create(this.appModule, new ExpressAdapter(expressApp), {
        logger: this.logger,
      }),
      {
        swagger: {
          documentBuilder: this.options?.swagger?.documentBuilder,
          documentFactory: this.options?.swagger?.documentFactory,
          options: {
            swaggerOptions: {
              requestInterceptor: (request: unknown) =>
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-expect-error
                __request__interceptor(request),
            },
            customJsStr: `
window.__request__interceptor = (request) => {
  const url = new URL(request.url);
  const endPoint = url.pathname;
  const origin = location.origin;
  const path = location.pathname.replace(/\\/help$/, '');
  let newUrl = origin + path + endPoint
  if (url.searchParams.size) {
    newUrl += '?' + url.searchParams.toString();
  }
  request.url = newUrl;
  return request;
}`,
          },
        },
        getTraceId: (request) => {
          const traceId =
            request.get(TRACE_ID_HEADER) ||
            request.get(TRACE_ID_HEADER.toLowerCase());
          if (!traceId) {
            return;
          }
          return traceId.split('/').at(0);
        },
        extraGlobalExceptions: [
          ...(this.options?.extraGlobalExceptions ?? []),
          PUB_SUB_PUBLISH_ERROR,
          EVENTARC_PUBLISH_ERROR,
          FUNCTION_CALL_UNKNOWN_ERROR,
          FUNCTION_CALL_INVALID_RESPONSE,
        ],
      },
    );
    const loggerMiddleware = new LoggerMiddleware();
    app.use(loggerMiddleware.use.bind(loggerMiddleware));
    await app.init();
    return (this.apps = [app, expressApp]);
  }

  async getAppContext(): Promise<INestApplicationContext> {
    return (this.appContext ??= await NestFactory.createApplicationContext(
      this.appModule,
      { logger: this.logger },
    ));
  }
}
