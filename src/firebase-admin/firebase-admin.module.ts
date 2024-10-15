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
import { FactoryProvider, Provider } from '@stlmpp/di';
import { Class } from 'type-fest';

export function provideFirebaseAdmin(): Array<Provider | Class<any>> {
  return [
    { provide: FirebaseAdminApp, useFactory: () => initializeApp() },
    new FactoryProvider(FirebaseAdminAuth, (app) => getAuth(app), [
      FirebaseAdminApp,
    ]),
    new FactoryProvider(
      FirebaseAdminFirestore,
      (app) => {
        const firestore = getFirestore(app);
        try {
          firestore.settings({ ignoreUndefinedProperties: true });
        } catch {
          Logger.warn('Could not set firestore settings');
          // Ignore
        }
        return firestore;
      },
      [FirebaseAdminApp],
    ),
    new FactoryProvider(FirebaseAdminEventarc, (app) => getEventarc(app), [
      FirebaseAdminApp,
    ]),
    Eventarc,
  ];
}
