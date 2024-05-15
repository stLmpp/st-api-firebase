import { z, ZodSchema } from 'zod';

export const CallableDataSchema = z.object({
  body: z.any(),
  correlationId: z.string().optional(),
  traceId: z.string().optional(),
  originExecutionId: z.string().optional(),
});

export type CallableData<RequestSchema extends ZodSchema> = z.infer<
  typeof CallableDataSchema
> & { body: z.infer<RequestSchema> };
