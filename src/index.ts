import 'firebase-functions/logger/compat';
export {
  type CallableHandle,
  type CallableHandler,
  type CallableHandlerOptions,
  createCallableHandler,
} from './callable/callable-handler.factory.js';
export { CallableData } from './callable/callable-data.schema.js';
export { inject } from './common/inject.js';
export { isEmulator } from './common/is-emulator.js';
export {
  Eventarc,
  type EventarcPublishOptions,
} from './eventarc/eventarc.service.js';
export { EventarcData } from './eventarc/eventarc-data.schema.js';
export {
  type EventarcHandlerOptions,
  type EventarcHandler,
  type EventarcHandle,
  createEventarcHandler,
} from './eventarc/eventarc-handler.factory.js';
export { provideFirebase } from './firebase/firebase.module.js';
export { FirebaseApp } from './firebase/firebase-app.js';
export { FirebaseAuth } from './firebase/firebase-auth.js';
export {
  type FirebaseFunctionsCallOptions,
  FirebaseFunctions,
  type CallableResult,
  type CallableResultError,
  type CallableResultSuccess,
} from './firebase/firebase-functions.js';
export { provideFirebaseAdmin } from './firebase-admin/firebase-admin.module.js';
export { FirebaseAdminApp } from './firebase-admin/firebase-admin-app.js';
export { FirebaseAdminAuth } from './firebase-admin/firebase-admin-auth.js';
export { FirebaseAdminEventarc } from './firebase-admin/firebase-admin-eventarc.js';
export { FirebaseAdminFirestore } from './firebase-admin/firebase-admin-firestore.js';
export { PubSub } from './pub-sub/pub-sub.service.js';
export { providePubSub } from './pub-sub/pub-sub.module.js';
export {
  type PubSubHandlerOptions,
  type PubSubEventData,
  type PubSubHandler,
  type PubSubHandle,
  createPubSubHandler,
} from './pub-sub/pub-sub-handler.factory.js';

export {
  type StFirebaseAppCallableMiddleware,
  type StFirebaseAppAdapter,
  StFirebaseAppDefaultAdapter,
  type StFirebaseAppEventarcMiddleware,
  type StFirebaseAppPubSubMiddleware,
} from './app.adapter.js';
export { StFirebaseApp } from './app.js';
export {
  type StFirebaseAppOptions,
  type StFirebaseAppHttpOptions,
  type StFirebaseAppHandlerOptions,
} from './app.type.js';
export {
  DefaultFirebaseAppNamingStrategy,
  type StFirebaseAppNamingStrategy,
} from './app-naming-strategy.js';
export { Logger } from './logger.js';
export { RetryEvent } from './retry-event.js';
