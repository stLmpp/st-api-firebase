import { StFirebaseAppOptions } from './app.type.js';
import { HonoAppOptions } from '@st-api/core';
import { Hono } from 'hono';

export function mergeAppOptions(
  ...options: StFirebaseAppOptions[]
): StFirebaseAppOptions {
  if (!options.length) {
    return { controllers: [] };
  }
  const [first, ...rest] = options;
  const final: StFirebaseAppOptions = first ?? { controllers: [] };
  const swaggerBuilders: HonoAppOptions<Hono>['swaggerDocumentBuilder'][] = [];
  for (const option of rest) {
    if (option.handlerOptions) {
      final.handlerOptions = Object.assign(
        final.handlerOptions ?? {},
        option.handlerOptions,
      );
    }
    if (option.secrets?.length) {
      final.secrets ??= [];
      final.secrets.push(...option.secrets);
    }
    if (option.controllers.length) {
      final.controllers.push(...option.controllers);
    }
    if (option.providers?.length) {
      final.providers ??= [];
      final.providers.push(...option.providers);
    }
    if (option.extraGlobalExceptions?.length) {
      final.extraGlobalExceptions ??= [];
      final.extraGlobalExceptions.push(...option.extraGlobalExceptions);
    }
    if (option.swaggerDocumentBuilder) {
      swaggerBuilders.push(option.swaggerDocumentBuilder);
    }
  }
  final.swaggerDocumentBuilder = (document) =>
    swaggerBuilders.reduce((acc, item) => item?.(acc) ?? acc, document);
  return final;
}
