import { z } from 'zod';

import { ERROR_CODES } from '../constants/error-codes';

export const fieldErrorSchema = z.object({
  path: z.string(),
  message: z.string(),
});

export const problemDetailsSchema = z.object({
  type: z.string().url(),
  title: z.string().min(1),
  status: z.number().int().min(100).max(599),
  detail: z.string().optional(),
  code: z.enum(ERROR_CODES),
  instance: z.string().min(1),
  errors: z.array(fieldErrorSchema).optional(),
});

export type FieldError = z.infer<typeof fieldErrorSchema>;
export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
