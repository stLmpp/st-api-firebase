import { Firestore, CollectionReference } from 'firebase-admin/firestore';

import { getClazz } from '../common/get-clazz.js';
import { FactoryProvider, Injectable, InjectionToken } from '@stlmpp/di';

@Injectable()
export class FirebaseAdminFirestore extends getClazz<Firestore>() {}

export function createCollectionProvider(
  collection: string,
): [InjectionToken<CollectionReference>, FactoryProvider] {
  const token = new InjectionToken<CollectionReference>(
    `st-api-firebase-collection-${collection}`,
  );
  return [
    token,
    new FactoryProvider(
      token,
      (firestore) => firestore.collection(collection),
      [FirebaseAdminFirestore],
    ),
  ];
}
