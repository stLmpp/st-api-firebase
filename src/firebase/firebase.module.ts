import { DynamicModule, Module } from '@nestjs/common';
import { FirebaseOptions, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth } from 'firebase/auth';
import { connectFunctionsEmulator, getFunctions } from 'firebase/functions';

import { EMULATOR_HOST } from '../common/constants.js';
import { isEmulator } from '../common/is-emulator.js';
import { Logger } from '../logger.js';

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
              const projectId =
                process.env.GCP_PROJECT || process.env.GCLOUD_PROJECT;
              if (!projectId) {
                Logger.debug(
                  'Could not find projectId on GCP_PROJECT or GCLOUD_PROJECT environment variables. ' +
                    'Using "dev" as the projectId, this can lead to unexpected bugs',
                );
              }
              options ??= {
                apiKey: 'dev',
                appId: 'dev',
                projectId: projectId ?? 'dev',
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
              Logger.debug(
                `Connecting functions emulator at ${EMULATOR_HOST}:${firebaseJson.emulators.functions.port}`,
              );
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
              const url = `http://${EMULATOR_HOST}:${firebaseJson.emulators.auth.port}`;
              Logger.debug(`Connecting auth emulator at ${url}`);
              connectAuthEmulator(auth, url);
            }
            return auth;
          },
          inject: [FirebaseApp],
        },
      ],
    };
  }
}
