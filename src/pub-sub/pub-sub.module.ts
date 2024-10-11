import { PubSub as GooglePubSub } from '@google-cloud/pubsub';
import { PubSub } from './pub-sub.service.js';

export function providePubSub() {
  return [
    {
      provide: GooglePubSub,
      useFactory: () => new GooglePubSub(),
    },
    PubSub,
  ];
}
