import { INestApplicationContext } from '@nestjs/common';
import {
  apiStateRunInContext,
  createCorrelationId,
  Exception,
  formatZodErrorString,
  safeAsync,
} from '@st-api/core';
import {
  CallableFunction,
  CallableOptions,
  CallableRequest,
  HttpsError,
  onCall,
} from 'firebase-functions/v2/https';
import { Class } from 'type-fest';
import { z, ZodSchema } from 'zod';

import { StFirebaseAppCallableMiddleware } from '../app.adapter.js';
import { APP_SYMBOL } from '../common/inject.js';
import { removeCircular } from '../common/remove-circular.js';
import {
  CALLABLE_BAD_FORMAT,
  CALLABLE_BAD_REQUEST,
  CALLABLE_BAD_RESPONSE,
  CALLABLE_INVALID_HANDLER,
  CALLABLE_UNKNOWN_ERROR,
} from '../exceptions.js';
import { Logger } from '../logger.js';

import { CallableData } from './callable-data.schema.js';
import { getHttpsErrorFromStatus } from './https-error-mapping.js';

export type CallableHandlerFactoryOptions = CallableOptions;

export type CallableHandle<
  RequestSchema extends ZodSchema,
  ResponseSchema extends ZodSchema,
> = (
  event: CallableRequest<z.infer<RequestSchema>>,
) => Promise<z.input<ResponseSchema>>;
export interface CallableHandler<
  RequestSchema extends ZodSchema,
  ResponseSchema extends ZodSchema,
> {
  handle: CallableHandle<RequestSchema, ResponseSchema>;
}
export type CallableHandlers<
  RequestSchema extends ZodSchema,
  ResponseSchema extends ZodSchema,
> =
  | { handle: CallableHandle<RequestSchema, ResponseSchema> }
  | { handler: Class<CallableHandler<RequestSchema, ResponseSchema>> };
export interface CallableHandlerSchema<
  RequestSchema extends ZodSchema,
  ResponseSchema extends ZodSchema,
> {
  request: RequestSchema;
  response: ResponseSchema;
}

export type CallableHandlerOptions<
  RequestSchema extends ZodSchema = ZodSchema,
  ResponseSchema extends ZodSchema = ZodSchema,
> = {
  name: string;
  schema: () =>
    | Promise<CallableHandlerSchema<RequestSchema, ResponseSchema>>
    | CallableHandlerSchema<RequestSchema, ResponseSchema>;
} & Pick<CallableOptions, 'preserveExternalChanges'> &
  CallableHandlers<RequestSchema, ResponseSchema>;

export class CallableHandlerFactory {
  constructor(
    private readonly options: CallableHandlerFactoryOptions,
    private readonly getApp: () => Promise<INestApplicationContext>,
    private readonly middleware: StFirebaseAppCallableMiddleware,
  ) {}

  create<RequestSchema extends ZodSchema, ResponseSchema extends ZodSchema>(
    options: CallableHandlerOptions<RequestSchema, ResponseSchema>,
  ): CallableFunction<z.infer<RequestSchema>, z.infer<ResponseSchema>> {
    let schema:
      | CallableHandlerSchema<RequestSchema, ResponseSchema>
      | undefined;
    let handler: CallableHandle<RequestSchema, ResponseSchema>;
    const getSchema = async () => (schema ??= await options.schema());
    const getHandle = async (app: INestApplicationContext) =>
      (handler ??= await this.getHandle(options, app));
    return onCall(
      {
        ...this.options,
        preserveExternalChanges:
          options.preserveExternalChanges ??
          this.options.preserveExternalChanges,
      },
      async (request) => {
        const app = await this.getApp();
        const callableValidation = CallableData.safeParse(request.data);
        const callableData = callableValidation.success
          ? callableValidation.data
          : undefined;
        const correlationId =
          callableData?.correlationId ?? createCorrelationId();
        const traceId = callableData?.traceId ?? createCorrelationId();
        const [error, result] = await safeAsync(() =>
          apiStateRunInContext(
            async () => {
              Logger.debug(
                `[Callable - ${options.name}] Request received (before middleware)`,
                { request: { data: request.data, auth: request.auth } },
              );
              request = this.middleware(request);
              Logger.debug(
                `[Callable - ${options.name}] Request received (after middleware)`,
                { request: { data: request.data, auth: request.auth } },
              );
              if (!callableValidation.success) {
                throw CALLABLE_BAD_FORMAT(
                  formatZodErrorString(callableValidation.error),
                );
              }
              const { request: requestSchema, response: responseSchema } =
                await getSchema();
              const requestValidation = await requestSchema.safeParseAsync(
                callableValidation.data.body,
              );
              if (!requestValidation.success) {
                throw CALLABLE_BAD_REQUEST(
                  formatZodErrorString(requestValidation.error),
                );
              }
              const handle = await getHandle(app);
              request.data = requestValidation.data;
              const response = await handle(request);
              const responseValidation =
                await responseSchema.safeParseAsync(response);
              if (!responseValidation.success) {
                throw CALLABLE_BAD_RESPONSE(
                  formatZodErrorString(responseValidation.error),
                );
              }
              return responseValidation.data;
            },
            {
              metadata: {
                [APP_SYMBOL]: app,
              },
              traceId,
              correlationId,
            },
          ),
        );
        if (!error) {
          return result;
        }
        const stringError = JSON.stringify({
          error: removeCircular(error),
          errorString: String(error),
        });
        if (error instanceof Exception) {
          Logger.info(
            `[Callable ${options.name}] known error = ${stringError}`,
          );
          throw new HttpsError(
            getHttpsErrorFromStatus(error.getStatus()),
            error.message,
            error.toJSON(),
          );
        }
        Logger.error(
          `[Callable ${options.name}] unknown error = ${stringError}`,
        );
        const unknownError = CALLABLE_UNKNOWN_ERROR(stringError);
        throw new HttpsError(
          getHttpsErrorFromStatus(unknownError.getStatus()),
          unknownError.message,
          unknownError.toJSON(),
        );
      },
    );
  }

  private async getHandle<
    RequestSchema extends ZodSchema,
    ResponseSchema extends ZodSchema,
  >(
    options: CallableHandlerOptions<RequestSchema, ResponseSchema>,
    app: INestApplicationContext,
  ): Promise<CallableHandle<RequestSchema, ResponseSchema>> {
    if ('handle' in options) {
      return options.handle;
    }
    const [error, handler] = await safeAsync(() =>
      app.resolve(options.handler),
    );
    if (error) {
      Logger.error(
        `[Callable] Could not find instance of ${options.handler.name}, ` +
          `make sure it is registered in the module providers`,
        error,
      );
      throw CALLABLE_INVALID_HANDLER(error.message);
    }
    return (...args) => handler.handle(...args);
  }
}

export function createCallableHandler<
  RequestSchema extends ZodSchema,
  ResponseSchema extends ZodSchema,
>(
  options: CallableHandlerOptions<RequestSchema, ResponseSchema>,
): CallableHandlerOptions<RequestSchema, ResponseSchema> {
  return options;
}
