import { Module } from '@nestjs/common';

import { OrganizationController } from './controllers/organization.controller.js';
import { OrganizationService } from './services/organization.service.js';
import { OrganizationRepository } from './repositories/organization.repository.js';

@Module({
  controllers: [OrganizationController],
  providers: [OrganizationService, OrganizationRepository],
  exports: [OrganizationService],
})
export class OrganizationModule {}
