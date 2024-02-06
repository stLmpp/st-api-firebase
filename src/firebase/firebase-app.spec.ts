import { Test } from '@nestjs/testing';

import { FirebaseApp } from './firebase-app.js';

describe('firebase-app', () => {
  let firebaseApp: FirebaseApp;

  beforeEach(async () => {
    const ref = await Test.createTestingModule({
      providers: [FirebaseApp],
    }).compile();
    firebaseApp = ref.get(FirebaseApp);
  });

  it('should create instance', () => {
    expect(firebaseApp).toBeDefined();
  });
});
