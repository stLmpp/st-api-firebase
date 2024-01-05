import 'reflect-metadata';
import { Exception } from '@st-api/core';
import { expect } from 'vitest';

expect.extend({
  async toThrowException(received: unknown, expected: Exception) {
    if (!(received instanceof Exception)) {
      return {
        pass: false,
        message: () => `Expected ${expected} to be instance of Exception`,
      };
    }
    if (!this.equals(received.toJSON(), expected.toJSON())) {
      return {
        pass: false,
        message: () =>
          `Expected Exception is different from received Exception\n${this.utils.diff(
            received.toJSON(),
            expected.toJSON(),
          )}`,
      };
    }
    return {
      pass: true,
      message: () => '',
    };
  },
});
