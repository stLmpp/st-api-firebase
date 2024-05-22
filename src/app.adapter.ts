import { CloudEvent } from 'firebase-functions/v2';
import { CallableRequest } from 'firebase-functions/v2/https';
import { MessagePublishedData } from 'firebase-functions/v2/pubsub';

import { StFirebaseAppOptions } from './app.type.js';
import { identity } from './common/identity.js';

export interface StFirebaseAppAdapter {
  eventarcMiddleware: StFirebaseAppEventarcMiddleware;
  pubSubMiddleware: StFirebaseAppPubSubMiddleware;
  callableMiddleware: StFirebaseAppCallableMiddleware;
  options?: Omit<StFirebaseAppOptions, 'adapter'>;
}

export class StFirebaseAppDefaultAdapter implements StFirebaseAppAdapter {
  eventarcMiddleware = identity;
  pubSubMiddleware = identity;
  callableMiddleware = identity;
}

export interface StFirebaseAppEventarcMiddleware {
  (event: CloudEvent<unknown>): CloudEvent<unknown>;
}

export interface StFirebaseAppPubSubMiddleware {
  (
    event: CloudEvent<MessagePublishedData<unknown>>,
  ): CloudEvent<MessagePublishedData<unknown>>;
}

export interface StFirebaseAppCallableMiddleware {
  (request: CallableRequest<unknown>): CallableRequest<unknown>;
}
