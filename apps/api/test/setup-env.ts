import { loadEnvFiles } from '../src/core/config/env-file.ts';

loadEnvFiles();

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (testDatabaseUrl === undefined || testDatabaseUrl.length === 0) {
  throw new Error(
    'TEST_DATABASE_URL is required for integration tests (docs/ARCHITECTURE.md §12.2). ' +
      'Start the test database with: docker compose up -d postgres-test',
  );
}
process.env.DATABASE_URL = testDatabaseUrl;
