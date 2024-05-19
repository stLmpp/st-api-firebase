import { z } from 'zod';

export const CallableData = z.object({
  body: z.unknown(),
  correlationId: z.string().optional(),
  traceId: z.string().optional(),
  originExecutionId: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).default({}),
});

export type CallableData = z.infer<typeof CallableData>;
