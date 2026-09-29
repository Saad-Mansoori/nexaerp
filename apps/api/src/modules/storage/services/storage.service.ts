import { Injectable } from '@nestjs/common';
import { StorageClient } from '@supabase/storage-js';

import { AppConfigService } from '@nexaerp/api/core/config/app-config.service.js';
import { getTenantId } from '@nexaerp/api/core/tenancy/tenant-context.js';
import {
  storageObjectSchema,
  type StorageObject,
  uploadUrlRequestSchema,
  type UploadUrlRequest,
  signedUrlRequestSchema,
  type SignedUrlRequest,
} from '@nexaerp/shared';

interface FileObject {
  name: string;
  bucket_id: string;
  owner: string;
  id: string;
  updated_at: string;
  created_at: string;
  last_accessed_at: string;
  metadata: Record<string, unknown>;
  buckets: { id: string; name: string };
}

@Injectable()
export class StorageService {
  private client: StorageClient;

  constructor(private readonly config: AppConfigService) {
    this.client = new StorageClient(`${config.supabaseUrl}/storage/v1`, {
      Authorization: `Bearer ${config.supabaseServiceRoleKey}`,
    });
  }

  async generateUploadUrl(
    input: UploadUrlRequest,
  ): Promise<{ uploadUrl: string; objectKey: string; expiresAt: string }> {
    const tenantId = getTenantId();
    if (!tenantId) throw new Error('Tenant context required');

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
    const objectKey = `${tenantId}/${timestamp}/${crypto.randomUUID()}-${input.key.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

    const { data, error } = await this.client.from(input.bucket).createSignedUploadUrl(objectKey);

    if (error || !data) {
      throw new Error(`Failed to generate upload URL: ${error?.message}`);
    }

    return {
      uploadUrl: data.signedUrl,
      objectKey,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }

  async generateSignedUrl(
    input: SignedUrlRequest,
  ): Promise<{ downloadUrl: string; expiresAt: string }> {
    const tenantId = getTenantId();
    if (!tenantId) throw new Error('Tenant context required');

    const { data, error } = await this.client
      .from('nexaerp-media')
      .createSignedUrl(input.objectId, 60);

    if (error || !data) {
      throw new Error(`Failed to generate signed URL: ${error?.message}`);
    }

    return {
      downloadUrl: data.signedUrl,
      expiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
    };
  }

  async listObjects(bucket: string, prefix?: string): Promise<StorageObject[]> {
    const tenantId = getTenantId();
    if (!tenantId) throw new Error('Tenant context required');

    const { data, error } = await this.client.from(bucket).list(prefix ?? `${tenantId}/`);

    if (error) {
      throw new Error(`Failed to list objects: ${error.message}`);
    }

    return (data ?? []).map((obj: FileObject) =>
      storageObjectSchema.parse({
        id: obj.id,
        tenantId,
        bucket: obj.bucket_id,
        key: obj.name,
        mimeType: (obj.metadata?.mimetype as string) ?? 'application/octet-stream',
        size: (obj.metadata?.size as number) ?? 0,
        createdAt: obj.created_at,
        updatedAt: obj.updated_at,
      }),
    );
  }

  async deleteObject(bucket: string, objectKey: string): Promise<void> {
    const tenantId = getTenantId();
    if (!tenantId) throw new Error('Tenant context required');

    if (!objectKey.startsWith(`${tenantId}/`)) {
      throw new Error('Cannot delete objects from other tenants');
    }

    const { error } = await this.client.from(bucket).remove([objectKey]);

    if (error) {
      throw new Error(`Failed to delete object: ${error.message}`);
    }
  }
}
