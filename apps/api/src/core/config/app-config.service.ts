import { Injectable } from '@nestjs/common';

import { loadEnvFiles } from './env-file.js';
import { envSchema, type Env } from './env.schema.js';

@Injectable()
export class AppConfigService {
  private readonly env: Env;

  constructor() {
    loadEnvFiles();
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
      const issues = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('; ');
      throw new Error(`Invalid environment configuration: ${issues}`);
    }
    this.env = parsed.data;
  }

  get nodeEnv(): Env['NODE_ENV'] {
    return this.env.NODE_ENV;
  }

  get port(): number {
    return this.env.PORT;
  }

  get webOrigins(): string[] {
    return this.env.WEB_ORIGIN.split(',')
      .map((origin) => origin.trim())
      .filter((origin) => origin.length > 0);
  }

  get databaseUrl(): string {
    return this.env.DATABASE_URL;
  }

  get logLevel(): Env['LOG_LEVEL'] {
    return this.env.LOG_LEVEL;
  }

  get throttleTtlMs(): number {
    return this.env.THROTTLE_TTL_MS;
  }

  get throttleLimit(): number {
    return this.env.THROTTLE_LIMIT;
  }

  get autoMigrate(): boolean {
    return this.env.AUTO_MIGRATE === 'true';
  }

  get supabaseUrl(): string | undefined {
    return this.env.SUPABASE_URL;
  }

  get supabaseJwtSecret(): string | undefined {
    return this.env.SUPABASE_JWT_SECRET;
  }

  get supabaseServiceRoleKey(): string | undefined {
    return this.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  get supabaseStorageBucket(): string | undefined {
    return this.env.SUPABASE_STORAGE_BUCKET;
  }
}
