import { StFirebaseAppOptions } from './app.type.js';
import { HonoAppOptions } from '@st-api/core';
import { Hono } from 'hono';

const AUTO_MERGE_KEYS = [
  'getTraceId',
  'getCorrelationId',
  'getExecutionId',
] satisfies Array<keyof StFirebaseAppOptions>;

export function mergeAppOptions(
  ...options: StFirebaseAppOptions[]
): StFirebaseAppOptions {
  if (!options.length) {
    return { controllers: [] };
  }
  const [first, ...rest] = options;
  const final: StFirebaseAppOptions = first ?? { controllers: [] };
  const swaggerBuilders: NonNullable<
    HonoAppOptions<Hono>['swaggerDocumentBuilder']
  >[] = [];
  if (first?.swaggerDocumentBuilder) {
    swaggerBuilders.push(first.swaggerDocumentBuilder);
  }
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
    if (option.cors) {
      final.cors = {
        ...final.cors,
        ...option.cors,
      };
    }
    for (const key of AUTO_MERGE_KEYS) {
      final[key] = option[key] ?? final[key];
    }
  }
  final.swaggerDocumentBuilder = (document) =>
    swaggerBuilders.reduce((acc, item) => item(acc), document);
  return final;
}
