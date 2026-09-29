import { z } from 'zod';

const optionalSecret = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.string().min(1).optional(),
);

const optionalUrl = z.preprocess(
  (value) => (value === '' || value === undefined ? undefined : value),
  z.url().optional(),
);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  WEB_ORIGIN: z.string().min(1).default('http://localhost:3000'),
  DATABASE_URL: z.string().min(1),
  DIRECT_URL: optionalSecret,
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  THROTTLE_TTL_MS: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(300),
  AUTO_MIGRATE: z.enum(['true', 'false']).default('false'),
  SUPABASE_URL: optionalUrl,
  SUPABASE_JWT_SECRET: optionalSecret,
  SUPABASE_SERVICE_ROLE_KEY: optionalSecret,
  SUPABASE_STORAGE_BUCKET: optionalSecret,
});

export type Env = z.infer<typeof envSchema>;
