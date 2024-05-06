import { Injectable } from '@nestjs/common';
import {
  Exception,
  formatZodErrorString,
  getCorrelationId,
  getExecutionId,
  getTraceId,
  safeAsync,
} from '@st-api/core';
import {
  Functions,
  getFunctions,
  httpsCallable,
  HttpsCallable,
} from 'firebase/functions';
import { HttpsError } from 'firebase-functions/v2/https';
import { z, ZodSchema } from 'zod';

import { removeCircular } from '../common/remove-circular.js';
import {
  FUNCTION_CALL_INVALID_RESPONSE,
  FUNCTION_CALL_UNKNOWN_ERROR,
} from '../exceptions.js';

import { FirebaseApp } from './firebase-app.js';

type CallSuccess<T> = [error: undefined, data: T];
type CallError = [error: Exception, data: undefined];
type CallResult<T> = CallSuccess<T> | CallError;

export interface FirebaseFunctionsCallOptions<Schema extends ZodSchema> {
  name: string;
  body: unknown;
  schema: Schema;
}

@Injectable()
export class FirebaseFunctions {
  constructor(private readonly firebaseApp: FirebaseApp) {}

  private readonly cache = new Map<string, HttpsCallable>();
  private functions?: Functions;

  private getFunctions(): Functions {
    if (!this.functions) {
      this.functions = getFunctions(this.firebaseApp);
    }
    return this.functions;
  }

  private getCallable(name: string): HttpsCallable {
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }
    const functions = this.getFunctions();
    const callable = httpsCallable(functions, name);
    this.cache.set(name, callable);
    return callable;
  }

  async call<Schema extends ZodSchema>({
    name,
    body,
    schema,
  }: FirebaseFunctionsCallOptions<Schema>): Promise<
    CallResult<z.infer<Schema>>
  > {
    const callable = this.getCallable(name);
    const [error, response] = await safeAsync(() =>
      callable({
        body,
        correlation: getCorrelationId(),
        traceId: getTraceId(),
        originExecutionId: getExecutionId(),
      }),
    );
    if (!error) {
      const result = schema.safeParse(response.data);
      if (!result.success) {
        return [
          FUNCTION_CALL_INVALID_RESPONSE(formatZodErrorString(result.error)),
          undefined,
        ];
      }
      return [undefined, result.data];
    }
    if (
      error instanceof HttpsError &&
      Exception.isExceptionJSON(error.details)
    ) {
      return [Exception.fromJSON(error.details), undefined];
    }
    return [
      FUNCTION_CALL_UNKNOWN_ERROR(
        JSON.stringify({
          error: removeCircular(error),
          errorString: String(error),
        }),
      ),
      undefined,
    ];
  }
}
