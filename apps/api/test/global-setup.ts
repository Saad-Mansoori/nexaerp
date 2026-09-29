import { execSync } from 'node:child_process';

import { loadEnvFiles } from '../src/core/config/env-file.js';

export default function globalSetup(): void {
  loadEnvFiles();

  const testDatabaseUrl = process.env.TEST_DATABASE_URL;
  if (testDatabaseUrl === undefined || testDatabaseUrl.length === 0) {
    throw new Error(
      'TEST_DATABASE_URL is required for integration tests (docs/ARCHITECTURE.md §12.2).',
    );
  }

  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DIRECT_URL: testDatabaseUrl },
  });
}
