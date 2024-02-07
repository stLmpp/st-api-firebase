import { Inject, Injectable } from '@nestjs/common';
import {
  coerceArray,
  getCorrelationId,
  getTraceId,
  StApiName,
} from '@st-api/core';

import { FirebaseAdminEventarc } from '../firebase-admin/firebase-admin-eventarc.js';

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

  async publish(
    optionOrOptions: EventarcPublishOptions | EventarcPublishOptions[],
  ): Promise<void> {
    const options = coerceArray(optionOrOptions);
    await this.firebaseAdminEventarc.channel().publish(
      options.map((item) => ({
        data: {
          body: item.body,
          traceId: getTraceId(),
          correlationId: getCorrelationId(),
        } satisfies EventarcData,
        type: item.type,
        source: this.stApiName,
      })),
    );
  }
}
