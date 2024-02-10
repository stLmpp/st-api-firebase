import { DynamicModule, Logger, Module, Type } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import {
  Throttler,
  ThrottlerGuard,
  ThrottlerOptions,
  ThrottlerOptionsToken,
} from '@st-api/core';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getEventarc } from 'firebase-admin/eventarc';
import { getFirestore } from 'firebase-admin/firestore';
import { FirebaseFunctionsRateLimiter } from 'firebase-functions-rate-limiter/dist/FirebaseFunctionsRateLimiter.js';

import { isEmulator } from '../common/is-emulator.js';
import { EventarcController } from '../eventarc/eventarc.controller.js';
import { Eventarc } from '../eventarc/eventarc.service.js';

import { FirebaseAdminApp } from './firebase-admin-app.js';
import { FirebaseAdminAuth } from './firebase-admin-auth.js';
import { FirebaseAdminEventarc } from './firebase-admin-eventarc.js';
import { FirebaseAdminFirestore } from './firebase-admin-firestore.js';
import {
  FirebaseAdminAsyncOptionsType,
  FirebaseAdminBaseClass,
  FirebaseAdminModuleOptions,
  FirebaseAdminOptionsToken,
  FirebaseAdminOptionsType,
} from './firebase-admin.config.js';
import { FirebaseFunctionsRateLimiterToken } from './firebase-functions-rate-limiter.token.js';
import {
  FirestoreThrottler,
  FirestoreThrottlerCollectionNameToken,
  FirestoreThrottlerDisabled,
} from './firestore-throttler.js';

const controllers: Type[] = [];

if (isEmulator()) {
  controllers.push(EventarcController);
}

@Module({
  exports: [
    FirebaseAdminApp,
    FirebaseAdminFirestore,
    FirebaseAdminAuth,
    FirebaseAdminEventarc,
    Eventarc,
  ],
  providers: [
    {
      provide: ThrottlerOptionsToken,
      useFactory: (options: FirebaseAdminModuleOptions) =>
        ({
          ttl: options.throttlerTtl ?? 5,
          limit: options.throttlerLimit ?? 10,
        }) satisfies ThrottlerOptions,
      inject: [FirebaseAdminOptionsToken],
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: Throttler,
      useClass: FirestoreThrottler,
    },
    {
      provide: FirestoreThrottlerCollectionNameToken,
      useFactory: (options?: FirebaseAdminModuleOptions) =>
        options?.throttlerFirestoreCollectionName ?? 'rate-limit',
      inject: [FirebaseAdminOptionsToken],
    },
    {
      provide: FirestoreThrottlerDisabled,
      useFactory: (options?: FirebaseAdminModuleOptions) =>
        options?.throttlerDisabled ?? false,
      inject: [FirebaseAdminOptionsToken],
    },
    { provide: FirebaseAdminApp, useFactory: () => initializeApp() },
    {
      provide: FirebaseAdminAuth,
      useFactory: (app: FirebaseAdminApp) => getAuth(app),
      inject: [FirebaseAdminApp],
    },
    {
      provide: FirebaseAdminFirestore,
      useFactory: (app: FirebaseAdminApp) => {
        const firestore = getFirestore(app);
        try {
          firestore.settings({ ignoreUndefinedProperties: true });
        } catch {
          Logger.warn('Could not set firestore settings');
          // Ignore
        }
        return firestore;
      },
      inject: [FirebaseAdminApp],
    },
    {
      provide: FirebaseAdminEventarc,
      useFactory: (app: FirebaseAdminApp) => getEventarc(app),
      inject: [FirebaseAdminApp],
    },
    {
      provide: FirebaseFunctionsRateLimiterToken,
      useValue: FirebaseFunctionsRateLimiter,
    },
    Eventarc,
  ],
  controllers,
})
export class FirebaseAdminModule extends FirebaseAdminBaseClass {
  static forRoot(options: FirebaseAdminOptionsType = {}): DynamicModule {
    return {
      ...super.forRoot(options),
    };
  }

  static forRootAsync(options: FirebaseAdminAsyncOptionsType): DynamicModule {
    return {
      ...super.forRootAsync(options),
    };
  }
}
