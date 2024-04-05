import { ParamIntSchema } from '@st-api/core';

export class RetryEvent extends Error {}

export const RetryEventDiffSchema = ParamIntSchema.catch(
  () => 12 * 60 * 60 * 1000,
);

export const RETRY_EVENT_MAX_DIFF = RetryEventDiffSchema.parse(
  process.env.ST_API_RETRY_EVENT_MAX_DIFF,
);
