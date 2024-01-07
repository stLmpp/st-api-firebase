import { PubSub as GooglePubSub, type Topic } from '@google-cloud/pubsub';
import { Injectable } from '@nestjs/common';
import { getCorrelationId } from '@st-api/core';

import { QUEUE_CORRELATION_ID_ATTR_KEY } from '../queue/constants.js';

@Injectable()
export class PubSub {
  constructor(private readonly googlePubSub: GooglePubSub) {}

  async publish(
    topic: string,
    message: Parameters<Topic['publishMessage']>[0],
  ): Promise<void> {
    message.attributes ??= {};
    message.attributes[QUEUE_CORRELATION_ID_ATTR_KEY] ??= getCorrelationId();
    await this.googlePubSub.topic(topic).publishMessage(message);
  }
}
