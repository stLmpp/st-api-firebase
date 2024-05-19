import { PubSub as GooglePubSub } from '@google-cloud/pubsub';
import { Module } from '@nestjs/common';

import { PubSub } from './pub-sub.service.js';

@Module({
  providers: [
    {
      provide: GooglePubSub,
      useFactory: () => new GooglePubSub(),
    },
    PubSub,
  ],
  exports: [PubSub],
})
export class PubSubModule {}
