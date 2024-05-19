import { CloudEvent } from 'firebase-functions/v2';
import { CallableRequest } from 'firebase-functions/v2/https';
import { MessagePublishedData } from 'firebase-functions/v2/pubsub';

import { identity } from './common/identity.js';

export interface StFirebaseAppAdapter {
  eventarcMiddleware: StFirebaseAppEventarcMiddleware;
  pubSubMiddleware: StFirebaseAppPubSubMiddleware;
  callableMiddleware: StFirebaseAppCallableMiddleware;
}

export class StFirebaseAppDefaultAdapter implements StFirebaseAppAdapter {
  eventarcMiddleware = identity;
  pubSubMiddleware = identity;
  callableMiddleware = identity;
}

export interface StFirebaseAppEventarcMiddleware {
  <T = unknown>(event: CloudEvent<T>): CloudEvent<T>;
}

export interface StFirebaseAppPubSubMiddleware {
  <T = unknown>(
    event: CloudEvent<MessagePublishedData<T>>,
  ): CloudEvent<MessagePublishedData<T>>;
}

export interface StFirebaseAppCallableMiddleware {
  <T = unknown>(request: CallableRequest<T>): CallableRequest<T>;
}
