import { Test } from '@nestjs/testing';

import { FirebaseAdminAuth } from './firebase-admin-auth.js';

describe('firebase-admin-auth', () => {
  let firebaseAdminAuth: FirebaseAdminAuth;

  beforeEach(async () => {
    const ref = await Test.createTestingModule({
      providers: [FirebaseAdminAuth],
    }).compile();
    firebaseAdminAuth = ref.get(FirebaseAdminAuth);
  });

  it('should create instance', () => {
    expect(firebaseAdminAuth).toBeDefined();
  });
});
