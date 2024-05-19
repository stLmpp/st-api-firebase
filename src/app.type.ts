import { ConfigureAppOptions } from '@st-api/core';
import { CloudEvent, CloudFunction } from 'firebase-functions/v2';
import { HttpsOptions } from 'firebase-functions/v2/https';

import { StFirebaseAppAdapter } from './app.adapter.js';

export type StFirebaseAppRecord = Record<
  string,
  CloudFunction<CloudEvent<unknown>>
>;

export interface StFirebaseAppOptions {
  secrets?: HttpsOptions['secrets'];
  swagger?: Pick<
    NonNullable<ConfigureAppOptions['swagger']>,
    'documentBuilder' | 'documentFactory'
  >;
  extraGlobalExceptions?: ConfigureAppOptions['extraGlobalExceptions'];
  handlerOptions?: StFirebaseAppHandlerOptions;
  adapter?: StFirebaseAppAdapter;
}

export interface StFirebaseAppHandlerOptions {
  preserveExternalChanges?: boolean;
  retry?: boolean;
}

export interface StFirebaseAppHttpOptions {
  preserveExternalChanges?: boolean;
}
