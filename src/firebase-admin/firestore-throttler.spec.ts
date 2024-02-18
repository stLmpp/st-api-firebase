import { Test } from '@nestjs/testing';
import { mock } from 'vitest-mock-extended';

import { FirebaseAdminFirestore } from './firebase-admin-firestore.js';
import {
  FirestoreThrottler,
  FirestoreThrottlerCollectionNameToken,
} from './firestore-throttler.js';

describe('firestore-throttler', () => {
  let throttler: FirestoreThrottler;

  const firebaseAdminFirestoreMock = mock<FirebaseAdminFirestore>();

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
      ],
    }).compile();
    throttler = ref.get(FirestoreThrottler);
  });

  it('should create instance', () => {
    expect(throttler).toBeDefined();
  });
});
