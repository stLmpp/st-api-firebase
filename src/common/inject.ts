import { getStateMetadataKey, HonoApp } from '@st-api/core';
import { Class } from 'type-fest';
import { Hono } from 'hono';
import { InjectionToken } from '@stlmpp/di';

export const APP_SYMBOL = Symbol('APP_SYMBOL');

export function inject<T>(
  type: Class<T> | InjectionToken<T>,
  options: { optional: true },
): T | undefined;
export function inject<T>(
  type: Class<T> | InjectionToken<T>,
  options: { optional: false },
): T;
export function inject<T>(
  type: Class<T> | InjectionToken<T>,
  options?: { optional: boolean },
): T;
export function inject<T>(
  type: Class<T> | InjectionToken<T>,
  options?: { optional: boolean },
): T | undefined {
  const app = getStateMetadataKey(APP_SYMBOL) as HonoApp<Hono> | undefined;
  if (!app) {
    throw new Error('App is not running on context');
  }
  return app.injector.get(type, options);
}
