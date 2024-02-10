import { PubSub as GooglePubSub } from '@google-cloud/pubsub';
import { Module, Type } from '@nestjs/common';

import { isEmulator } from '../common/is-emulator.js';

import { PubSubController } from './pub-sub.controller.js';
import { PubSub } from './pub-sub.service.js';

const controllers: Type[] = [];

if (isEmulator()) {
  controllers.push(PubSubController);
}

@Module({
  providers: [
    {
      provide: GooglePubSub,
      useFactory: () => new GooglePubSub(),
    },
    PubSub,
  ],
  controllers,
  exports: [PubSub],
})
export class PubSubModule {}
