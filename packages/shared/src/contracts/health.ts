import { z } from 'zod';

export const healthStatusSchema = z.enum(['live', 'ready']);

export const healthResponseSchema = z.object({
  data: z.object({
    status: healthStatusSchema,
  }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
