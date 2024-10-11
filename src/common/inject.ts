import { getStateMetadataKey, HonoApp } from '@st-api/core';
import { Class } from 'type-fest';
import { Hono } from 'hono';

export const APP_SYMBOL = Symbol('APP_SYMBOL');

export function inject<T>(type: Class<T>): T {
  const app = getStateMetadataKey(APP_SYMBOL) as HonoApp<Hono> | undefined;
  if (!app) {
    throw new Error('App is not running on context');
  }
  return app.injector.get(type);
}
