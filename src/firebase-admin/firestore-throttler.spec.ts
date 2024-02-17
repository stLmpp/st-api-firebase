import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TOO_MANY_REQUESTS } from '@st-api/core';
import { FirebaseFunctionsRateLimiter } from '@st-api/firebase-functions-rate-limiter';
import { mock } from 'vitest-mock-extended';

import { FirebaseAdminFirestore } from './firebase-admin-firestore.js';
import { FirebaseFunctionsRateLimiterToken } from './firebase-functions-rate-limiter.token.js';
import {
  FirestoreThrottler,
  FirestoreThrottlerCollectionNameToken,
} from './firestore-throttler.js';

describe('firestore-throttler', () => {
  let throttler: FirestoreThrottler;

  const firebaseAdminFirestoreMock = mock<FirebaseAdminFirestore>();
  const firebaseFunctionsRateLimiterMock = {
    withFirestoreBackend: vi.fn(),
  };

  beforeEach(async () => {
    vi.resetAllMocks();
    const ref = await Test.createTestingModule({
      providers: [
        FirestoreThrottler,
        {
          provide: FirebaseAdminFirestore,
          useFactory: () => firebaseAdminFirestoreMock,
        },
        {
          provide: FirestoreThrottlerCollectionNameToken,
          useValue: 'rate-limit',
        },
        {
          provide: FirebaseFunctionsRateLimiterToken,
          useFactory: () => firebaseFunctionsRateLimiterMock,
        },
      ],
    }).compile();
    throttler = ref.get(FirestoreThrottler);
  });

  it('should create instance', () => {
    expect(throttler).toBeDefined();
  });

  it('should throw error if rate limited', async () => {
    const limiterMock = mock<FirebaseFunctionsRateLimiter>({
      rejectOnQuotaExceededOrRecordUsage: vi
        .fn()
        .mockRejectedValue(new Error('1')),
    });
    vi.spyOn(
      firebaseFunctionsRateLimiterMock,
      'withFirestoreBackend',
    ).mockReturnValue(limiterMock);
    const context = mock<ExecutionContext>({
      getHandler: vi.fn().mockReturnValue({
        name: 'handler',
      }),
      getClass: vi.fn().mockReturnValue({
        name: 'class',
      }),
      switchToHttp: vi.fn().mockReturnValue({
        getRequest: vi.fn().mockReturnValue({
          ip: 'ip',
        }),
      }),
    });
    await expect(() =>
      throttler.rejectOnQuotaExceededOrRecordUsage({
        context,
        ttl: 1,
        limit: 2,
      }),
    ).rejects.toThrowException(TOO_MANY_REQUESTS());
  });
});
