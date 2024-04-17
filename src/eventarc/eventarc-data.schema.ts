import { z } from 'zod';

export const EventarcData = z.object({
  body: z.any(),
  correlationId: z.string().optional(),
  traceId: z.string().optional(),
  originExecutionId: z.string().optional(),
});

export type EventarcData = z.infer<typeof EventarcData>;
