import { Inject, Injectable } from '@nestjs/common';
import {
  safeAsync,
  Throttler,
  ThrottlerOptionsArgs,
  TOO_MANY_REQUESTS,
} from '@st-api/core';
import { FirebaseFunctionsRateLimiter } from 'firebase-functions-rate-limiter';

import { FirebaseAdminFirestore } from './firebase-admin-firestore.js';
import { FirebaseFunctionsRateLimiterToken } from './firebase-functions-rate-limiter.token.js';

export const FirestoreThrottlerCollectionNameToken =
  'FirestoreThrottlerCollectionNameToken';
export const FirestoreThrottlerDisabled = 'FirestoreThrottlerDisabled';

@Injectable()
export class FirestoreThrottler extends Throttler {
  constructor(
    private readonly firebaseAdminFirestore: FirebaseAdminFirestore,
    @Inject(FirestoreThrottlerCollectionNameToken)
    private readonly collectionName: string,
    @Inject(FirebaseFunctionsRateLimiterToken)
    private readonly firebaseFunctionsRateLimiter: typeof FirebaseFunctionsRateLimiter,
    @Inject(FirestoreThrottlerDisabled)
    private readonly firestoreThrottlerDisabled: boolean,
  ) {
    super();
  }

  async rejectOnQuotaExceededOrRecordUsage({
    context,
    ttl,
    limit,
  }: ThrottlerOptionsArgs): Promise<void> {
    if (this.firestoreThrottlerDisabled) {
      return;
    }
    const rateLimiter = this.firebaseFunctionsRateLimiter.withFirestoreBackend(
      {
        name: this.collectionName,
        maxCalls: limit,
        periodSeconds: ttl,
      },
      this.firebaseAdminFirestore,
    );
    const prefix = `${context.getClass().name}-${context.getHandler().name}`;
    const [error] = await safeAsync(() =>
      rateLimiter.rejectOnQuotaExceededOrRecordUsage(
        `${prefix}-${context.switchToHttp().getRequest().ip}`,
      ),
    );
    if (error) {
      throw TOO_MANY_REQUESTS();
    }
  }
}
