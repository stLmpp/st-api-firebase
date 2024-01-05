import { Exception } from '@st-api/core';

interface CustomMatchers<R = unknown> {
  toThrowException(expected: Exception): R;
}

declare module 'vitest' {
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
