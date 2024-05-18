import { INestApplicationContext } from '@nestjs/common';
import { getStateMetadataKey } from '@st-api/core';
import { Class } from 'type-fest';

export const APP_SYMBOL = Symbol('APP_SYMBOL');

export function inject<T>(type: Class<T>): T {
  const app = getStateMetadataKey(APP_SYMBOL) as
    | INestApplicationContext
    | undefined;
  if (!app) {
    throw new Error('App is not running on context');
  }
  return app.get(type);
}
