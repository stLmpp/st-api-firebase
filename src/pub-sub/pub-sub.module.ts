import { PubSub as GooglePubSub } from '@google-cloud/pubsub';
import { PubSub } from './pub-sub.service.js';
import { Provider } from '@stlmpp/di';
import { Class } from 'type-fest';

export function providePubSub(): Array<Provider | Class<any>> {
  return [
    {
      provide: GooglePubSub,
      useFactory: () => new GooglePubSub(),
    },
    PubSub,
  ];
}
