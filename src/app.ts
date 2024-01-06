import { INestApplication } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { configureApp } from '@st-api/core';
import express, { Express } from 'express';
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

export class StFirebaseApp<
  T extends StFirebaseAppRecord = NonNullable<unknown>,
> {
  private constructor(
    private readonly appModule: Class<any>,
    private readonly options?: StFirebaseAppOptions,
  ) {
    this.createQueueHandler = queueHandlerFactory(async () => {
      const [app] = await this.getApp();
      return app;
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
  private appsPromise: [Promise<INestApplication>, Express] | undefined;

  getHttpHandler(): HttpsFunction {
    return onRequest(
      {
        secrets: this.options?.secrets,
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
    if (this.appsPromise) {
      const [appPromise, expressApp] = this.appsPromise;
      return [await appPromise, expressApp];
    }
    if (this.apps) {
      return this.apps;
    }
    const expressApp = express();
    const appPromise = NestFactory.create(
      this.appModule,
      new ExpressAdapter(expressApp),
      {
        logger,
      },
    );
    this.appsPromise = [appPromise, expressApp];
    const app = configureApp(await appPromise, {
      swagger: {},
    });
    await app.init();
    return (this.apps = [app, expressApp]);
  }
}
