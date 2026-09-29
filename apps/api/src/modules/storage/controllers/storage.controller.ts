import {
  Controller,
  Get,
  Post,
  Delete,
  Query,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import { StorageService } from '../services/storage.service.js';
import { RequirePermissions } from '@nexaerp/api/core/rbac/permissions.decorator.js';
import {
  uploadUrlRequestSchema,
  type UploadUrlRequest,
  signedUrlRequestSchema,
  type SignedUrlRequest,
} from '@nexaerp/shared';
import { ZodValidationPipe } from '@nexaerp/api/core/errors/zod-validation.pipe.js';

@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  @Post('objects/upload-url')
  @RequirePermissions('storage.upload')
  async getUploadUrl(@Body(new ZodValidationPipe(uploadUrlRequestSchema)) input: UploadUrlRequest) {
    return this.storageService.generateUploadUrl(input);
  }

  @Post('objects/:objectId/url')
  @RequirePermissions('storage.upload')
  async getSignedUrl(@Param() params: SignedUrlRequest) {
    return this.storageService.generateSignedUrl(params);
  }

  @Get('objects')
  @RequirePermissions('storage.upload')
  async listObjects(@Query('bucket') bucket: string, @Query('prefix') prefix?: string) {
    return this.storageService.listObjects(bucket, prefix);
  }

  @Delete('objects/:bucket/:objectKey')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermissions('storage.delete')
  async deleteObject(@Param('bucket') bucket: string, @Param('objectKey') objectKey: string) {
    return this.storageService.deleteObject(bucket, objectKey);
  }
}
