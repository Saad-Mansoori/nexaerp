import { z } from 'zod';

export const storageObjectSchema = z.object({
  id: z.uuid(),
  tenantId: z.uuid(),
  bucket: z.string(),
  key: z.string(),
  mimeType: z.string(),
  size: z.number().int().nonnegative(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type StorageObject = z.infer<typeof storageObjectSchema>;

export const uploadUrlRequestSchema = z.object({
  bucket: z.enum(['nexaerp-media', 'nexaerp-documents']),
  key: z.string().min(1).max(512),
  mimeType: z.string(),
  size: z.number().int().positive().max(10_000_000),
});

export type UploadUrlRequest = z.infer<typeof uploadUrlRequestSchema>;

export const uploadUrlResponseSchema = z.object({
  data: z.object({
    uploadUrl: z.url(),
    objectKey: z.string(),
    expiresAt: z.iso.datetime(),
  }),
});

export type UploadUrlResponse = z.infer<typeof uploadUrlResponseSchema>;

export const signedUrlRequestSchema = z.object({
  objectId: z.uuid(),
});

export type SignedUrlRequest = z.infer<typeof signedUrlRequestSchema>;

export const signedUrlResponseSchema = z.object({
  data: z.object({
    downloadUrl: z.url(),
    expiresAt: z.iso.datetime(),
  }),
});

export type SignedUrlResponse = z.infer<typeof signedUrlResponseSchema>;

export const storageObjectsResponseSchema = z.object({
  data: z.array(storageObjectSchema),
  meta: z.object({
    page: z.number().int().positive(),
    pageSize: z.number().int().positive(),
    total: z.number().int().nonnegative(),
  }),
});

export type StorageObjectsResponse = z.infer<typeof storageObjectsResponseSchema>;

export const storageObjectResponseSchema = z.object({
  data: storageObjectSchema,
});

export type StorageObjectResponse = z.infer<typeof storageObjectResponseSchema>;
