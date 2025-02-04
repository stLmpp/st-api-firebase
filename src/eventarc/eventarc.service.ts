import {
  coerceArray,
  getCorrelationId,
  getExecutionId,
  getTraceId,
  safeAsync,
  StApiName,
} from '@st-api/core';

import { isEmulator } from '../common/is-emulator.js';
import { EVENTARC_PUBLISH_ERROR } from '../exceptions.js';
import { FirebaseAdminEventarc } from '../firebase-admin/firebase-admin-eventarc.js';
import { Logger } from '../logger.js';

import { EventarcData } from './eventarc-data.schema.js';
import { Inject, Injectable } from '@stlmpp/di';

export interface EventarcPublishOptions {
  type: string;
  body: unknown;
  attributes?: Record<string, unknown>;
}

@Injectable({ root: true })
export class Eventarc {
  constructor(
    private readonly firebaseAdminEventarc: FirebaseAdminEventarc,
    @Inject(StApiName) private readonly stApiName: string,
  ) {}

  private readonly logger = Logger.create(this);

  async publish(
    optionOrOptions: EventarcPublishOptions | EventarcPublishOptions[],
  ): Promise<void> {
    const options = coerceArray(optionOrOptions);
    const [error] = await safeAsync(() =>
      this.firebaseAdminEventarc.channel().publish(
        options.map((item) => ({
          data: {
            body: item.body,
            traceId: getTraceId(),
            correlationId: getCorrelationId(),
            originExecutionId: getExecutionId(),
            attributes: item.attributes ?? {},
          } satisfies EventarcData,
          type: item.type,
          source: this.stApiName,
        })),
      ),
    );
    if (!error) {
      return;
    }
    if (isEmulator()) {
      this.logger.info(`Error while publishing message`, error);
      return;
    }
    throw EVENTARC_PUBLISH_ERROR(JSON.stringify(error));
  }
}
