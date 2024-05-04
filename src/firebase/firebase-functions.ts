import { Injectable } from '@nestjs/common';
import {
  Functions,
  getFunctions,
  httpsCallable,
  HttpsCallable,
} from 'firebase/functions';

import { FirebaseApp } from './firebase-app.js';

@Injectable()
export class FirebaseFunctions {
  constructor(private readonly firebaseApp: FirebaseApp) {}

  private readonly cache = new Map<string, HttpsCallable>();
  private functions?: Functions;

  private getFunctions(): Functions {
    if (!this.functions) {
      this.functions = getFunctions(this.firebaseApp);
    }
    return this.functions;
  }

  private getCallable(name: string): HttpsCallable {
    if (this.cache.has(name)) {
      return this.cache.get(name)!;
    }
    const functions = this.getFunctions();
    const callable = httpsCallable(functions, name);
    this.cache.set(name, callable);
    return callable;
  }

  async call(name: string, data: unknown): Promise<unknown> {
    const callable = this.getCallable(name);
    const { data: resultData } = await callable(data);
    return resultData;
  }
}
