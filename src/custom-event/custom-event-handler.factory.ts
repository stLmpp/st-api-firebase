import { apiStateRunInContext, HonoApp, safeAsync } from '@st-api/core';
import { CloudFunction as CloudFunctionV1 } from 'firebase-functions/v1';
import { CloudEvent, CloudFunction } from 'firebase-functions/v2';

import {
  StFirebaseAppCustomEventContext,
  StFirebaseAppOptionsExtended,
} from '../app.type.js';
import { CloudEventType } from '../cloud-event-type.enum.js';
import { handleCloudEventError } from '../common/handle-cloud-event-error.js';
import { APP_SYMBOL } from '../common/inject.js';
import { Hono } from 'hono';

export class CustomEventHandlerFactory {
  constructor(
    private readonly options: StFirebaseAppOptionsExtended,
    private readonly getApp: () => Promise<HonoApp<Hono>>,
  ) {}

  create(
    name: string,
    callback: (
      context: StFirebaseAppCustomEventContext,
    ) => CloudFunction<CloudEvent<unknown>> | CloudFunctionV1<any>,
  ): CloudFunction<CloudEvent<unknown>> | CloudFunctionV1<any> {
    return callback({
      options: this.options,
      runInContext: async ({ run, state, eventTimestamp, eventData }) => {
        const app = await this.getApp();
        await apiStateRunInContext(
          async () => {
            const [error] = await safeAsync(() => run(app));
            if (!error) {
              return;
            }
            await handleCloudEventError({
              app,
              error,
              type: CloudEventType.Custom,
              eventTimestamp,
              data: eventData,
              name,
            });
          },
          {
            ...state,
            metadata: {
              ...state?.metadata,
              [APP_SYMBOL]: app,
            },
          },
        );
      },
    });
  }
}
