import { PubSub as GooglePubSub, type Topic } from '@google-cloud/pubsub';
import {
  getCorrelationId,
  getExecutionId,
  getTraceId,
  safeAsync,
} from '@st-api/core';

import {
  CORRELATION_ID_KEY,
  ORIGIN_EXECUTION_ID,
  TRACE_ID_KEY,
} from '../common/constants.js';
import { isEmulator } from '../common/is-emulator.js';
import { PUB_SUB_PUBLISH_ERROR } from '../exceptions.js';
import { Logger } from '../logger.js';
import { Injectable } from '@stlmpp/di';

@Injectable()
export class PubSub {
  constructor(private readonly googlePubSub: GooglePubSub) {}

  private readonly logger = Logger.create(this);

  async publish(
    topic: string,
    message: Parameters<Topic['publishMessage']>[0],
  ): Promise<void> {
    message.attributes ??= {};
    message.attributes[CORRELATION_ID_KEY] ??= getCorrelationId();
    message.attributes[TRACE_ID_KEY] ??= getTraceId();
    message.attributes[ORIGIN_EXECUTION_ID] = getExecutionId();
    const [error] = await safeAsync(() =>
      this.googlePubSub.topic(topic).publishMessage(message),
    );
    if (!error) {
      return;
    }
    if (isEmulator()) {
      this.logger.info(`Error while publishing message`, error);
      return;
    }
    throw PUB_SUB_PUBLISH_ERROR(JSON.stringify(error));
  }
}
