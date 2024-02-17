import { Inject, Injectable } from '@nestjs/common';
import {
  StApiName,
  Throttler,
  ThrottlerOptionsArgs,
  TOO_MANY_REQUESTS,
} from '@st-api/core';
import { FirebaseFunctionsRateLimiter } from '@st-api/firebase-functions-rate-limiter';
import { z } from 'zod';

import { Logger } from '../logger.js';

import { FirebaseAdminFirestore } from './firebase-admin-firestore.js';
import { FirebaseFunctionsRateLimiterToken } from './firebase-functions-rate-limiter.token.js';

export const FirestoreThrottlerCollectionNameToken =
  'FirestoreThrottlerCollectionNameToken';
export const FirestoreThrottlerDisabled = 'FirestoreThrottlerDisabled';

const DocumentSchema = z.object({
  u: z.number().array(),
});

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
    @Inject(StApiName)
    private readonly stApiName: string,
  ) {
    super();
  }

  private readonly logger = Logger.create(this);

  async rejectOnQuotaExceededOrRecordUsage({
    context,
    ttl,
    limit,
  }: ThrottlerOptionsArgs): Promise<void> {
    if (this.firestoreThrottlerDisabled) {
      return;
    }
    const key = `${this.stApiName}-${context.getClass().name}-${context.getHandler().name}-${context.switchToHttp().getRequest().ip}`;
    const document = this.firebaseAdminFirestore
      .collection(this.collectionName)
      .doc(key);
    const { count } = await this.firebaseAdminFirestore.runTransaction(
      async (transaction) => {
        const documentSnapshot = await transaction.get(document);
        const documentData = documentSnapshot.data();
        if (!documentData) {
          transaction.set(document, {
            u: [Date.now()],
          });
          return { count: 1 };
        }
        const now = Date.now();
        const result = DocumentSchema.safeParse(documentData);
        let data: z.infer<typeof DocumentSchema>;
        if (result.success) {
          data = result.data;
          data.u.push(now);
        } else {
          this.logger.debug(
            `key = ${key} with corrupted data. Rate limiting and correcting corrupted data`,
          );
          data = {
            u: Array.from({ length: limit }, () => now),
          };
        }
        let index = data.u.length;
        let internalCount = 0;
        const ttlDate = now - ttl * 100;
        while (index--) {
          if (data.u[index]! < ttlDate) {
            data.u.splice(index, 1);
          } else {
            internalCount++;
          }
        }
        transaction.set(document, data);
        return {
          count: internalCount,
        };
      },
    );
    if (count > limit) {
      throw TOO_MANY_REQUESTS();
    }
  }
}
