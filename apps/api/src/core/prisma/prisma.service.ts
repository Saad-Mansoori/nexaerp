import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '../../generated/prisma/client.js';
import { AppConfigService } from '../config/app-config.service.js';
import { createTenantDb, runWithTenantContext, type TenantDb } from './tenant-db.js';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(config: AppConfigService) {
    super({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  getTenantDb(tenantId: string): TenantDb {
    return createTenantDb(this, tenantId);
  }

  runWithTenantContext<T>(tenantId: string, fn: (tx: TenantDb) => Promise<T>): Promise<T> {
    return runWithTenantContext(this, tenantId, fn);
  }
}

export { type TenantDb, runWithTenantContext } from './tenant-db.js';
