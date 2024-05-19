import { z } from 'zod';

export const EventarcData = z.object({
  body: z.unknown(),
  correlationId: z.string().optional(),
  traceId: z.string().optional(),
  originExecutionId: z.string().optional(),
  attributes: z.record(z.string(), z.unknown()).default({}),
});

export type EventarcData = z.infer<typeof EventarcData>;
