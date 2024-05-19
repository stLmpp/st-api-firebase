import { INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { configureApp } from '@st-api/core';
import express, { Express } from 'express';
import { HttpsFunction, onRequest } from 'firebase-functions/v2/https';
import { Class } from 'type-fest';
import { ZodSchema } from 'zod';

import {
  StFirebaseAppAdapter,
  StFirebaseAppDefaultAdapter,
} from './app.adapter.js';
import {
  StFirebaseAppHttpOptions,
  StFirebaseAppOptions,
  StFirebaseAppRecord,
} from './app.type.js';
import {
  CallableHandlerFactory,
  CallableHandlerOptions,
} from './callable/callable-handler.factory.js';
import { TRACE_ID_HEADER } from './common/constants.js';
import { isEmulator } from './common/is-emulator.js';
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
import { EVENTARC_PUBLISH_ERROR, PUB_SUB_PUBLISH_ERROR } from './exceptions.js';
import { Logger } from './logger.js';
import { LoggerMiddleware } from './logger.middleware.js';
import {
  PubSubHandlerFactory,
  PubSubHandlerFactoryOptions,
  PubSubHandlerOptions,
} from './pub-sub/pub-sub-handler.factory.js';

export class StFirebaseApp {
  private constructor(
    private readonly appModule: Class<any>,
    private readonly options?: StFirebaseAppOptions,
  ) {
    this.adapter = options?.adapter ?? new StFirebaseAppDefaultAdapter();
    const commonOptions:
      | EventarcHandlerFactoryOptions
      | PubSubHandlerFactoryOptions = {
      retry: false,
      preserveExternalChanges: true,
      ...this.options?.handlerOptions,
      timeoutSeconds: TIMEOUT_SECONDS,
      concurrency: CONCURRENCY,
      cpu: USE_GEN1_CPU.value() ? 'gcf_gen1' : undefined,
      maxInstances: MAX_INSTANCES,
      secrets: options?.secrets ?? [],
      memory: MEMORY,
      minInstances: 0,
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
  }

  static create(
    appModule: Class<any>,
    options?: StFirebaseAppOptions,
  ): StFirebaseApp {
    return new StFirebaseApp(appModule, options);
  }

  private readonly logger = Logger.create(this);
  private readonly eventarcHandlerFactory: EventarcHandlerFactory;
  private readonly pubSubHandlerFactory: PubSubHandlerFactory;
  private readonly callableHandlerFactory: CallableHandlerFactory;
  private readonly cloudEvents: StFirebaseAppRecord = {};
  private readonly callables: Record<string, CallableFunction> = {};
  private readonly adapter: StFirebaseAppAdapter;
  private apps: [INestApplication, Express] | undefined;
  private appContext: INestApplicationContext | undefined;
  private eventNumber = 1;
  private pubSubNumber = 1;
  private hasHttpHandler = false;

  withHttpHandler(): this {
    this.hasHttpHandler = true;
    return this;
  }

  getHttpHandler(
    options: StFirebaseAppHttpOptions = {},
  ): HttpsFunction | undefined {
    if (!this.hasHttpHandler && !isEmulator()) {
      return undefined;
    }
    return onRequest(
      {
        secrets: this.options?.secrets ?? [],
        maxInstances: MAX_INSTANCES,
        memory: MEMORY,
        minInstances: 0,
        timeoutSeconds: TIMEOUT_SECONDS,
        preserveExternalChanges:
          this.options?.handlerOptions?.preserveExternalChanges,
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
    this.callables[options.name] = this.callableHandlerFactory.create(options);
    return this;
  }

  private getPubSubName(eventName: string): string {
    const [, , , name, version] = eventName.split('.');
    if (name && version) {
      return `pubsub_${name}_${version}`;
    }
    return `pubsub${this.pubSubNumber++}`;
  }

  addPubSub<Topic extends string, Schema extends ZodSchema>(
    options: PubSubHandlerOptions<Topic, Schema>,
  ): this {
    const key = this.getPubSubName(options.topic);
    this.cloudEvents[key] = this.pubSubHandlerFactory.create(options);
    return this;
  }

  private getEventarcName(eventName: string): string {
    const [, , , name, version] = eventName.split('.');
    if (name && version) {
      return `eventarc_${name}_${version}`;
    }
    return `eventarc${this.eventNumber++}`;
  }

  addEventarc<EventType extends string, Schema extends ZodSchema>(
    event: EventarcHandlerOptions<EventType, Schema>,
  ): this {
    const key = this.getEventarcName(event.eventType);
    this.cloudEvents[key] = this.eventarcHandlerFactory.create(event);
    return this;
  }

  async getApp(): Promise<[INestApplication, Express]> {
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
  const newUrl = origin + path + endPoint
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
        ],
      },
    );
    const loggerMiddleware = new LoggerMiddleware();
    app.use(loggerMiddleware.use.bind(loggerMiddleware));
    await app.init();
    return (this.apps = [app, expressApp]);
  }

  async getAppContext(): Promise<INestApplicationContext> {
    if (this.appContext) {
      return this.appContext;
    }
    const app = await NestFactory.createApplicationContext(this.appModule, {
      logger: this.logger,
    });
    return (this.appContext = app);
  }
}
