import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getEventarc } from 'firebase-admin/eventarc';
import { getFirestore } from 'firebase-admin/firestore';

import { Eventarc } from '../eventarc/eventarc.service.js';

import { FirebaseAdminApp } from './firebase-admin-app.js';
import { FirebaseAdminAuth } from './firebase-admin-auth.js';
import { FirebaseAdminEventarc } from './firebase-admin-eventarc.js';
import { FirebaseAdminFirestore } from './firebase-admin-firestore.js';
import { Logger } from '../logger.js';

export function provideFirebaseAdmin() {
  return [
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
  ];
}
