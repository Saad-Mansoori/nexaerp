import { Module } from '@nestjs/common';

import { IdentityController } from './controllers/identity.controller.js';
import { IdentityService } from './services/identity.service.js';
import { IdentityRepository } from './repositories/identity.repository.js';
import { RoleRepository } from './repositories/role.repository.js';

@Module({
  controllers: [IdentityController],
  providers: [IdentityService, IdentityRepository, RoleRepository],
  exports: [IdentityService],
})
export class IdentityModule {}
