import { Test } from '@nestjs/testing';

import { FirebaseAdminApp } from './firebase-admin-app.js';

describe('firebase-admin-app', () => {
  let firebaseAdminApp: FirebaseAdminApp;

  beforeEach(async () => {
    const ref = await Test.createTestingModule({
      providers: [FirebaseAdminApp],
    }).compile();
    firebaseAdminApp = ref.get(FirebaseAdminApp);
  });

  it('should create instance', () => {
    expect(firebaseAdminApp).toBeDefined();
  });
});
