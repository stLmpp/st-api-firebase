import { PubSub as GooglePubSub, type Topic } from '@google-cloud/pubsub';
import { Injectable } from '@nestjs/common';
import { getCorrelationId, getTraceId } from '@st-api/core';

import { CORRELATION_ID_KEY, TRACE_ID_KEY } from '../common/constants.js';

@Injectable()
export class PubSub {
  constructor(private readonly googlePubSub: GooglePubSub) {}

  async publish(
    topic: string,
    message: Parameters<Topic['publishMessage']>[0],
  ): Promise<void> {
    message.attributes ??= {};
    message.attributes[CORRELATION_ID_KEY] ??= getCorrelationId();
    message.attributes[TRACE_ID_KEY] ??= getTraceId();
    await this.googlePubSub.topic(topic).publishMessage(message);
  }
}
