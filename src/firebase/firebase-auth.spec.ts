import { Test } from '@nestjs/testing';

import { FirebaseAuth } from './firebase-auth.js';

describe('firebase-auth', () => {
  let firebaseAuth: FirebaseAuth;

  beforeEach(async () => {
    const ref = await Test.createTestingModule({
      providers: [FirebaseAuth],
    }).compile();
    firebaseAuth = ref.get(FirebaseAuth);
  });

  it('should create instance', () => {
    expect(firebaseAuth).toBeDefined();
  });
});
