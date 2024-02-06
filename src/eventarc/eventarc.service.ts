import { Injectable } from '@nestjs/common';
import { getCorrelationId, getTraceId } from '@st-api/core';

import { FirebaseAdminEventarc } from '../firebase-admin/firebase-admin-eventarc.js';

import { EventarcData } from './eventarc-data.schema.js';

@Injectable()
export class Eventarc {
  constructor(private readonly firebaseAdminEventarc: FirebaseAdminEventarc) {}

  async publish(type: string, body: unknown): Promise<void> {
    await this.firebaseAdminEventarc.channel().publish({
      data: {
        body,
        traceId: getTraceId(),
        correlationId: getCorrelationId(),
      } satisfies EventarcData,
      type,
    });
  }
}
