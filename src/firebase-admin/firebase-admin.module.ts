import { DynamicModule, Logger, Module } from '@nestjs/common';
import { ThrottlerOptions, ThrottlerOptionsToken } from '@st-api/core';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getEventarc } from 'firebase-admin/eventarc';
import { getFirestore } from 'firebase-admin/firestore';

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

const DEFAULT_THROTTLER_TTL_IN_SECONDS = 60;
const DEFAULT_THROTTLER_LIMIT = 90;

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
          ttl: options.throttlerTtl ?? DEFAULT_THROTTLER_TTL_IN_SECONDS,
          limit: options.throttlerLimit ?? DEFAULT_THROTTLER_LIMIT,
        }) satisfies ThrottlerOptions,
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
    Eventarc,
  ],
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
