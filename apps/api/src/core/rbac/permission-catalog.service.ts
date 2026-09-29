import { Injectable, OnModuleInit } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service.js';
import { PERMISSIONS, PERMISSION_DESCRIPTIONS } from '@nexaerp/shared';

@Injectable()
export class PermissionCatalogService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.syncCatalog();
  }

  async syncCatalog(): Promise<void> {
    for (const code of PERMISSIONS) {
      await this.prisma.permission.upsert({
        where: { code },
        update: { description: PERMISSION_DESCRIPTIONS[code] },
        create: {
          code,
          description: PERMISSION_DESCRIPTIONS[code],
        },
      });
    }
  }
}
