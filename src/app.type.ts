import { ApiState, HonoApp, HonoAppOptions } from '@st-api/core';
import {
  BlockingFunction,
  CloudFunction as CloudFunctionV1,
} from 'firebase-functions/v1';
import { Expression } from 'firebase-functions/params';
import {
  CloudEvent,
  CloudFunction,
  SupportedRegion,
} from 'firebase-functions/v2';
import { HttpsOptions } from 'firebase-functions/v2/https';
import { SetRequired } from 'type-fest';

import { StFirebaseAppNamingStrategy } from './app-naming-strategy.js';
import { StFirebaseAppAdapter } from './app.adapter.js';
import { Hono } from 'hono';

export type StFirebaseAppRecord = Record<
  string,
  CloudFunction<CloudEvent<unknown>> | CloudFunctionV1<any> | BlockingFunction
>;

export interface StFirebaseAppOptions
  extends Omit<HonoAppOptions<Hono>, 'hono' | 'name'> {
  adapter?: StFirebaseAppAdapter;
  secrets?: HttpsOptions['secrets'];
  handlerOptions?: StFirebaseAppHandlerOptions;
  namingStrategy?: StFirebaseAppNamingStrategy;
}

export interface StFirebaseAppHandlerOptions {
  preserveExternalChanges?: boolean;
  retry?: boolean;
  region?: SupportedRegion;
  timeoutSeconds?: number;
}

export interface StFirebaseAppHttpOptions {
  preserveExternalChanges?: boolean;
  region?: SupportedRegion;
  timeoutSeconds?: number;
}

export interface StFirebaseAppOptionsExtended
  extends SetRequired<StFirebaseAppOptions, 'secrets'> {
  retry: boolean;
  preserveExternalChanges: boolean;
  timeoutSeconds: number | Expression<number>;
  concurrency: number | Expression<number>;
  cpu: number | 'gcf_gen1' | undefined;
  maxInstances: number | Expression<number>;
  memory: Expression<number>;
  minInstances: number | Expression<number>;
  region?: SupportedRegion;
}

export interface StFirebaseAppCustomEventRunInContextOptions {
  state?: Partial<ApiState> & { metadata?: Record<string | symbol, unknown> };
  eventTimestamp: string;
  eventData: unknown;
  run: (app: HonoApp<Hono>) => Promise<unknown>;
}

export interface StFirebaseAppCustomEventContext {
  runInContext: (
    options: StFirebaseAppCustomEventRunInContextOptions,
  ) => Promise<void>;
  options: StFirebaseAppOptionsExtended;
}
