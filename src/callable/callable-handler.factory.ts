import { INestApplicationContext } from '@nestjs/common';
import {
  apiStateRunInContext,
  createCorrelationId,
  formatZodErrorString,
  getExecutionId,
  safeAsync,
} from '@st-api/core';
import {
  CallableFunction,
  CallableOptions,
  CallableRequest,
  onCall,
} from 'firebase-functions/v2/https';
import { Class } from 'type-fest';
import { z, ZodSchema } from 'zod';

import { APP_SYMBOL } from '../common/inject.js';
import {
  CALLABLE_BAD_FORMAT,
  CALLABLE_BAD_REQUEST,
  CALLABLE_BAD_RESPONSE,
  CALLABLE_INVALID_HANDLER,
} from '../exceptions.js';
import { Logger } from '../logger.js';

import { CallableData } from './callable-data.schema.js';

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
  RequestSchema extends ZodSchema,
  ResponseSchema extends ZodSchema,
> = {
  name: string;
  schema: () =>
    | Promise<CallableHandlerSchema<RequestSchema, ResponseSchema>>
    | CallableHandlerSchema<RequestSchema, ResponseSchema>;
  loggerContext?: (event: CallableRequest<unknown>) => string | undefined;
} & Pick<CallableOptions, 'preserveExternalChanges'> &
  CallableHandlers<RequestSchema, ResponseSchema>;

export class CallableHandlerFactory {
  constructor(
    private readonly options: CallableHandlerFactoryOptions,
    private readonly getApp: () => Promise<INestApplicationContext>,
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
        return apiStateRunInContext(
          async () => {
            if (!callableValidation.success) {
              throw CALLABLE_BAD_FORMAT(
                formatZodErrorString(callableValidation.error),
              );
            }
            const { request: requestSchema, response: responseSchema } =
              await getSchema();
            const requestValidation =
              await requestSchema.safeParseAsync(callableData);
            if (!requestValidation.success) {
              throw CALLABLE_BAD_REQUEST(
                formatZodErrorString(requestValidation.error),
              );
            }
            const handle = await getHandle(app);
            request.data = {
              body: requestValidation.data,
              traceId,
              correlationId,
              originExecutionId: getExecutionId(),
            } satisfies CallableData;
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
            [APP_SYMBOL]: app,
            traceId,
            correlationId,
          },
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
