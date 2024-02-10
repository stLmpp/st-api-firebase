import { INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { configureApp } from '@st-api/core';
import express, { Express } from 'express';
import { defineInt } from 'firebase-functions/params';
import { CloudEvent, CloudFunction } from 'firebase-functions/v2';
import {
  HttpsFunction,
  HttpsOptions,
  onRequest,
} from 'firebase-functions/v2/https';
import { Class } from 'type-fest';
import { ZodSchema } from 'zod';

import {
  EventarcHandlerFactory,
  EventarcHandlerFactoryOptions,
  EventarcHandlerOptions,
} from './eventarc/eventarc-handler.factory.js';
import { Logger } from './logger.js';
import {
  PubSubHandlerFactory,
  PubSubHandlerFactoryOptions,
  PubSubHandlerOptions,
} from './pub-sub/pub-sub-handler.factory.js';

type StFirebaseAppRecord = Record<string, CloudFunction<CloudEvent<unknown>>>;

export interface StFirebaseAppOptions {
  secrets?: HttpsOptions['secrets'];
}

const MAX_INSTANCES = defineInt('MAX_INSTANCES', {
  default: 2,
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
        { label: '2GiB', value: 2048 },
        { label: '4GiB', value: 4096 },
        { label: '8GiB', value: 8192 },
        { label: '16GiB', value: 16_384 },
        { label: '32GiB', value: 32_768 },
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
    };
    this.eventarcHandlerFactory = new EventarcHandlerFactory(
      commonOptions,
      () => this.getAppContext(),
    );
    this.pubSubHandlerFactory = new PubSubHandlerFactory(commonOptions, () =>
      this.getAppContext(),
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
  private readonly cloudEvents: StFirebaseAppRecord = {};
  private apps: [INestApplication, Express] | undefined;
  private appContext: INestApplicationContext | undefined;
  private eventNumber = 1;
  private pubSubNumber = 1;

  getHttpHandler(): HttpsFunction {
    return onRequest(
      {
        secrets: this.options?.secrets ?? [],
        maxInstances: MAX_INSTANCES,
        memory: MEMORY,
        minInstances: 0,
        timeoutSeconds: TIMEOUT_SECONDS,
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

  addPubSub<Topic extends string, Schema extends ZodSchema>(
    options: PubSubHandlerOptions<Topic, Schema>,
  ): this {
    const key = `pubSub${this.pubSubNumber++}`;
    this.cloudEvents[key] = this.pubSubHandlerFactory.create(options);
    return this;
  }

  addEventarc<EventType extends string, Schema extends ZodSchema>(
    event: EventarcHandlerOptions<EventType, Schema>,
  ): this {
    const key = `eventarc${this.eventNumber++}`;
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
        getTraceId: (request) =>
          request.get(TRACE_ID_HEADER) ||
          request.get(TRACE_ID_HEADER.toLowerCase()),
      },
    );
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
