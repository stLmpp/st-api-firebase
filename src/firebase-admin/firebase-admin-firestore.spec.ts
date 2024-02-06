import { Test } from '@nestjs/testing';

import { FirebaseAdminFirestore } from './firebase-admin-firestore.js';

describe('firebase-admin-firestore', () => {
  let firebaseAdminFirestore: FirebaseAdminFirestore;

  beforeEach(async () => {
    const ref = await Test.createTestingModule({
      providers: [FirebaseAdminFirestore],
    }).compile();
    firebaseAdminFirestore = ref.get(FirebaseAdminFirestore);
  });

  it('should create instance', () => {
    expect(firebaseAdminFirestore).toBeDefined();
  });
});
