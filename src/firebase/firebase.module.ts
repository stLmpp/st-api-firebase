import { DynamicModule, Module } from '@nestjs/common';
import { FirebaseOptions, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

import { EMULATOR_HOST } from '../common/constants.js';
import { isEmulator } from '../common/is-emulator.js';

import { FirebaseApp } from './firebase-app.js';
import { FirebaseAuth } from './firebase-auth.js';
import { FirebaseFunctions } from './firebase-functions.js';
import { getFirebaseJson } from './get-firebase-json.js';

@Module({})
export class FirebaseModule {
  static forRoot(options?: FirebaseOptions): DynamicModule {
    return {
      module: FirebaseModule,
      exports: [FirebaseApp, FirebaseAuth, FirebaseFunctions],
      providers: [
        FirebaseFunctions,
        {
          provide: FirebaseApp,
          useFactory: () => {
            if (isEmulator()) {
              options ??= {
                apiKey: 'dev',
                appId: 'dev',
                projectId: 'dev',
              };
            }
            const app = initializeApp(options ?? {});
            if (isEmulator()) {
              const firebaseJson = getFirebaseJson();
              if (!firebaseJson.emulators?.functions?.port) {
                throw new Error(
                  'firebase.json -> emulators.functions.port is required',
                );
              }
              connectFunctionsEmulator(
                getFunctions(app),
                EMULATOR_HOST,
                firebaseJson.emulators.functions.port,
              );
            }
            return app;
          },
        },
        {
          provide: FirebaseAuth,
          useFactory: (app: FirebaseApp) => {
            const auth = getAuth(app);
            if (isEmulator()) {
              const firebaseJson = getFirebaseJson();
              if (!firebaseJson.emulators?.auth?.port) {
                throw new Error(
                  'firebase.json -> emulators.auth.port is required',
                );
              }
              connectAuthEmulator(
                auth,
                `http://${EMULATOR_HOST}:${firebaseJson.emulators.auth.port}`,
              );
            }
            return auth;
          },
          inject: [FirebaseApp],
        },
      ],
    };
  }
}
