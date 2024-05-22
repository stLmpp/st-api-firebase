import { StFirebaseAppOptions } from './app.type.js';

export function mergeAppOptions(
  ...options: StFirebaseAppOptions[]
): StFirebaseAppOptions {
  if (!options.length) {
    return {};
  }
  const [first, ...rest] = options;
  const final: StFirebaseAppOptions = first ?? {};
  const swaggerBuilders: Array<NonNullable<StFirebaseAppOptions['swagger']>> = [
    final.swagger ?? {},
  ];
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
    if (option.extraGlobalExceptions?.length) {
      final.extraGlobalExceptions ??= [];
      final.extraGlobalExceptions.push(...option.extraGlobalExceptions);
    }
    if (option.swagger) {
      swaggerBuilders.push(option.swagger);
    }
  }
  final.swagger = {
    documentBuilder: (document) =>
      swaggerBuilders.reduce(
        (acc, item) => item.documentBuilder?.(acc) ?? acc,
        document,
      ),
    documentFactory: (document) =>
      swaggerBuilders.reduce(
        (acc, item) => item.documentFactory?.(acc) ?? acc,
        document,
      ),
  };
  return final;
}
