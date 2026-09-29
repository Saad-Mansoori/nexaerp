import { defineConfig } from 'prisma/config';

import { loadEnvFiles } from './src/core/config/env-file.js';

loadEnvFiles();

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? '',
  },
});
