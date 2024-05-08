import { INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { configureApp, ConfigureAppOptions } from '@st-api/core';
import express, { Express } from 'express';
import { defineBoolean, defineInt } from 'firebase-functions/params';
import { CloudEvent, CloudFunction } from 'firebase-functions/v2';
import {
  HttpsFunction,
  HttpsOptions,
  onRequest,
} from 'firebase-functions/v2/https';
import { Class } from 'type-fest';
import { ZodSchema } from 'zod';

import {
  CallableHandlerFactory,
  CallableHandlerOptions,
} from './callable/callable-handler.factory.js';
import { isEmulator } from './common/is-emulator.js';
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

type StFirebaseAppRecord = Record<string, CloudFunction<CloudEvent<unknown>>>;

export interface StFirebaseAppOptions {
  secrets?: HttpsOptions['secrets'];
  swagger?: Pick<
    NonNullable<ConfigureAppOptions['swagger']>,
    'documentBuilder' | 'documentFactory'
  >;
  extraGlobalExceptions?: ConfigureAppOptions['extraGlobalExceptions'];
  handlerOptions?: HandlerOptions;
}

export interface HandlerOptions {
  preserveExternalChanges?: boolean;
  retry?: boolean;
}

export interface StFirebaseAppHttpOptions {
  preserveExternalChanges?: boolean;
}

const MAX_INSTANCES = defineInt('MAX_INSTANCES', {
  default: 1,
  input: {
    select: {
      options: [
        { label: '1', value: 1 },
        { label: '2', value: 2 },
        { label: '3', value: 3 },
        { label: '4', value: 4 },
        { label: '5', value: 5 },
      ],
    },
  },
});
const MEMORY = defineInt('MEMORY', {
  default: 256,
  input: {
    select: {
      options: [
        { label: '128MiB', value: 128 },
        { label: '256MiB', value: 256 },
        { label: '512MiB', value: 512 },
        { label: '1GiB', value: 1024 },
      ],
    },
  },
});
const TIMEOUT_SECONDS = defineInt('TIMEOUT_SECONDS', {
  default: 30,
  input: {
    select: {
      options: [
        { label: '10', value: 10 },
        { label: '15', value: 15 },
        { label: '20', value: 20 },
        { label: '25', value: 25 },
        { label: '30', value: 30 },
        { label: '35', value: 35 },
        { label: '40', value: 40 },
        { label: '45', value: 45 },
        { label: '50', value: 50 },
      ],
    },
  },
});
const CONCURRENCY = defineInt('CONCURRENCY', {
  default: 80,
});
const USE_GEN1_CPU = defineBoolean('USE_GEN1_CPU', {
  default: false,
});

const TRACE_ID_HEADER = 'X-Cloud-Trace-Context';

export class StFirebaseApp {
  private constructor(
    private readonly appModule: Class<any>,
    private readonly options?: StFirebaseAppOptions,
  ) {
    const commonOptions:
      | EventarcHandlerFactoryOptions
      | PubSubHandlerFactoryOptions = {
      secrets: options?.secrets ?? [],
      maxInstances: MAX_INSTANCES,
      retry: false,
      memory: MEMORY,
      minInstances: 0,
      timeoutSeconds: TIMEOUT_SECONDS,
      concurrency: CONCURRENCY,
      cpu: USE_GEN1_CPU.value() ? 'gcf_gen1' : undefined,
      ...this.options?.handlerOptions,
    };
    this.eventarcHandlerFactory = new EventarcHandlerFactory(
      commonOptions,
      () => this.getAppContext(),
    );
    this.pubSubHandlerFactory = new PubSubHandlerFactory(commonOptions, () =>
      this.getAppContext(),
    );
    this.callableHandlerFactory = new CallableHandlerFactory(
      commonOptions,
      () => this.getAppContext(),
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
      return `${name}_${version}`;
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
      return `${name}_${version}`;
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

  private async getApp(): Promise<[INestApplication, Express]> {
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

  private async getAppContext(): Promise<INestApplicationContext> {
    if (this.appContext) {
      return this.appContext;
    }
    const app = await NestFactory.createApplicationContext(this.appModule, {
      logger: this.logger,
    });
    return (this.appContext = app);
  }
}
