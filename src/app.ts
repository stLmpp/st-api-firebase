import { INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { configureApp } from '@st-api/core';
import express, { Express } from 'express';
import { defineInt } from 'firebase-functions/params';
import { CloudEvent, CloudFunction, logger } from 'firebase-functions/v2';
import {
  HttpsFunction,
  HttpsOptions,
  onRequest,
} from 'firebase-functions/v2/https';
import { MessagePublishedData } from 'firebase-functions/v2/pubsub';
import { Class } from 'type-fest';
import { ZodSchema } from 'zod';

import {
  CreateQueueHandler,
  Queue,
  queueHandlerFactory,
} from './queue/queue-handler.js';

type StFirebaseAppRecord = Record<
  string,
  CloudFunction<CloudEvent<MessagePublishedData>>
>;

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

export class StFirebaseApp<
  T extends StFirebaseAppRecord = NonNullable<unknown>,
> {
  private constructor(
    private readonly appModule: Class<any>,
    private readonly options?: StFirebaseAppOptions,
  ) {
    this.createQueueHandler = queueHandlerFactory(() => this.getAppContext(), {
      memory: MEMORY,
      minInstances: 0,
      timeoutSeconds: TIMEOUT_SECONDS,
      secrets: options?.secrets ?? [],
      maxInstances: MAX_INSTANCES,
      retry: false,
    });
  }

  static create(
    appModule: Class<any>,
    options?: StFirebaseAppOptions,
  ): StFirebaseApp {
    return new StFirebaseApp(appModule, options);
  }

  private readonly createQueueHandler: CreateQueueHandler;
  private readonly queues: T = {} as any;
  private apps: [INestApplication, Express] | undefined;
  private appContext: INestApplicationContext | undefined;

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

  getQueueHandlers(): T {
    return this.queues;
  }

  addQueue<Topic extends string, Schema extends ZodSchema>(
    queue: Queue<Topic, Schema>,
  ): StFirebaseApp<
    T & { [K in Topic]: CloudFunction<CloudEvent<MessagePublishedData>> }
  > {
    (this.queues as StFirebaseAppRecord)[queue.topic] =
      this.createQueueHandler(queue);
    return this;
  }

  private async getApp(): Promise<[INestApplication, Express]> {
    if (this.apps) {
      return this.apps;
    }
    const expressApp = express();
    const app = configureApp(
      await NestFactory.create(this.appModule, new ExpressAdapter(expressApp), {
        logger,
      }),
      {
        swagger: {},
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
      logger,
    });
    return (this.appContext = app);
  }
}
