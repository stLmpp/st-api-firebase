import { z } from 'zod';

export const CallableData = z.object({
  body: z.any(),
  correlationId: z.string().optional(),
  traceId: z.string().optional(),
  originExecutionId: z.string().optional(),
});

export type CallableData = z.infer<typeof CallableData>;
