import {
  Firestore,
  CollectionReference,
  FirestoreDataConverter,
} from 'firebase-admin/firestore';

import { getClazz } from '../common/get-clazz.js';
import { FactoryProvider, Injectable, InjectionToken } from '@stlmpp/di';

@Injectable()
export class FirebaseAdminFirestore extends getClazz<Firestore>() {}

export function createCollectionProvider(
  collection: string,
): [InjectionToken<CollectionReference>, FactoryProvider];
export function createCollectionProvider<T>(
  collection: string,
  converter: FirestoreDataConverter<T>,
): [InjectionToken<CollectionReference<T>>, FactoryProvider];
export function createCollectionProvider(
  collection: string,
  converter?: FirestoreDataConverter<unknown>,
): [InjectionToken<CollectionReference>, FactoryProvider] {
  const token = new InjectionToken<CollectionReference>(
    `st-api-firebase-collection-${collection}`,
  );
  return [
    token,
    new FactoryProvider(
      token,
      (firestore) => {
        const collectionRef = firestore.collection(collection);
        if (converter) {
          return collectionRef.withConverter(converter);
        }
        return collectionRef;
      },
      [FirebaseAdminFirestore],
    ),
  ];
}
