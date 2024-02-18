import { Inject, Injectable } from '@nestjs/common';
import {
  coerceArray,
  getCorrelationId,
  getTraceId,
  safeAsync,
  StApiName,
} from '@st-api/core';

import { isEmulator } from '../common/is-emulator.js';
import { EVENTARC_PUBLISH_ERROR } from '../exceptions.js';
import { FirebaseAdminEventarc } from '../firebase-admin/firebase-admin-eventarc.js';
import { Logger } from '../logger.js';

import { EventarcData } from './eventarc-data.schema.js';

interface EventarcPublishOptions {
  type: string;
  body: unknown;
}

@Injectable()
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
