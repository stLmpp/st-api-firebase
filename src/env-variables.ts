import { defineBoolean, defineInt } from 'firebase-functions/params';

type IntParam = ReturnType<typeof defineInt>;
type BooleanParam = ReturnType<typeof defineBoolean>;

export const MAX_INSTANCES: IntParam = defineInt('MAX_INSTANCES', {
  default: 1,
  input: {
    select: {
      options: [
        { label: '1', value: 1 },
        { label: '2', value: 2 },
        { label: '3', value: 3 },
        { label: '4', value: 4 },
        { label: '5', value: 5 },
      ],
    },
  },
});
export const MEMORY: IntParam = defineInt('MEMORY', {
  default: 256,
  input: {
    select: {
      options: [
        { label: '128MiB', value: 128 },
        { label: '256MiB', value: 256 },
        { label: '512MiB', value: 512 },
        { label: '1GiB', value: 1024 },
      ],
    },
  },
});
export const TIMEOUT_SECONDS: IntParam = defineInt('TIMEOUT_SECONDS', {
  default: 30,
  input: {
    select: {
      options: [
        { label: '10', value: 10 },
        { label: '15', value: 15 },
        { label: '20', value: 20 },
        { label: '25', value: 25 },
        { label: '30', value: 30 },
        { label: '35', value: 35 },
        { label: '40', value: 40 },
        { label: '45', value: 45 },
        { label: '50', value: 50 },
      ],
    },
  },
});
export const CONCURRENCY: IntParam = defineInt('CONCURRENCY', {
  default: 80,
});
export const USE_GEN1_CPU: BooleanParam = defineBoolean('USE_GEN1_CPU', {
  default: false,
});
