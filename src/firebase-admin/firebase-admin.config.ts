import { ConfigurableModuleBuilder } from '@nestjs/common';

export interface FirebaseAdminModuleOptions {
  throttlerFirestoreCollectionName?: string;
  throttlerTtl?: number;
  throttlerLimit?: number;
  throttlerDisabled?: boolean;
}

const {
  MODULE_OPTIONS_TOKEN: FirebaseAdminOptionsToken,
  ConfigurableModuleClass: FirebaseAdminBaseClass,
  ASYNC_OPTIONS_TYPE,
  OPTIONS_TYPE,
} = new ConfigurableModuleBuilder<FirebaseAdminModuleOptions>()
  .setExtras(
    {
      isGlobal: true,
    },
    (definitions, extras) => ({
      ...definitions,
      global: extras.isGlobal,
    }),
  )
  .setClassMethodName('forRoot')
  .build();

export type FirebaseAdminAsyncOptionsType = typeof ASYNC_OPTIONS_TYPE;
export type FirebaseAdminOptionsType = typeof OPTIONS_TYPE;

export { FirebaseAdminOptionsToken, FirebaseAdminBaseClass };
