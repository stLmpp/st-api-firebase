import { INestApplicationContext } from '@nestjs/common';
import { ApiState, ConfigureAppOptions } from '@st-api/core';
import { CloudFunction as CloudFunctionV1 } from 'firebase-functions';
import { Expression } from 'firebase-functions/params';
import { CloudEvent, CloudFunction } from 'firebase-functions/v2';
import { HttpsOptions } from 'firebase-functions/v2/https';
import { SetRequired } from 'type-fest';

import { StFirebaseAppNamingStrategy } from './app-naming-strategy.js';
import { StFirebaseAppAdapter } from './app.adapter.js';

export type StFirebaseAppRecord = Record<
  string,
  CloudFunction<CloudEvent<unknown>> | CloudFunctionV1<any>
>;

export interface StFirebaseAppOptions {
  adapter?: StFirebaseAppAdapter;
  secrets?: HttpsOptions['secrets'];
  swagger?: Pick<
    NonNullable<ConfigureAppOptions['swagger']>,
    'documentBuilder' | 'documentFactory'
  >;
  extraGlobalExceptions?: ConfigureAppOptions['extraGlobalExceptions'];
  handlerOptions?: StFirebaseAppHandlerOptions;
  namingStrategy?: StFirebaseAppNamingStrategy;
}

export interface StFirebaseAppHandlerOptions {
  preserveExternalChanges?: boolean;
  retry?: boolean;
}

export interface StFirebaseAppHttpOptions {
  preserveExternalChanges?: boolean;
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
}

export interface StFirebaseAppCustomEventRunInContextOptions {
  state?: Partial<ApiState> & { metadata?: Record<string | symbol, unknown> };
  eventTimestamp: string;
  eventData: unknown;
  run: (app: INestApplicationContext) => Promise<unknown>;
}

export interface StFirebaseAppCustomEventContext {
  runInContext: (
    options: StFirebaseAppCustomEventRunInContextOptions,
  ) => Promise<void>;
  options: StFirebaseAppOptionsExtended;
}
