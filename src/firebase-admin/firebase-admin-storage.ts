import { Storage } from 'firebase-admin/storage';

import { getClazz } from '../common/get-clazz.js';
import { FactoryProvider, Injectable, InjectionToken } from '@stlmpp/di';
import { Bucket } from '@google-cloud/storage';

@Injectable()
export class FirebaseAdminStorage extends getClazz<Storage>() {}

export function createBucketProvider(
  bucketName: string,
): [InjectionToken<Bucket>, FactoryProvider] {
  const token = new InjectionToken<Bucket>(
    `st-api-firebase-bucket-${bucketName}`,
  );
  return [
    token,
    new FactoryProvider(
      token,
      (storage) => storage.bucket(bucketName) as never,
      [FirebaseAdminStorage],
    ),
  ];
}
