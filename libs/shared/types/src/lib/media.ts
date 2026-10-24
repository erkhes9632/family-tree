import { z } from 'zod';
import { partialDateSchema, type PartialDate } from './common';
import { MEDIA_CATEGORIES, MEDIA_KINDS, type MediaCategory, type MediaKind } from './enums';

export const createUploadSchema = z.object({
  kind: z.enum(MEDIA_KINDS),
  fileName: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  size: z.number().int().positive(),
  albumId: z.string().nullable().optional(),
  title: z.string().max(200).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  category: z.enum(MEDIA_CATEGORIES).default('other'),
  date: partialDateSchema.nullable().optional(),
  place: z.string().max(300).nullable().optional(),
  personIds: z.array(z.string()).max(100).default([]),
  /** client generated a thumbnail and will upload it too */
  withThumbnail: z.boolean().default(false),
  durationSec: z.number().nonnegative().nullable().optional(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
});
export type CreateUploadInput = z.infer<typeof createUploadSchema>;

export interface UploadTarget {
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
}

export interface CreateUploadResponse {
  media: MediaDto;
  /** single-request upload (small files) */
  upload: UploadTarget | null;
  /** multipart upload (large files) */
  multipart: { uploadId: string; partSize: number; partCount: number } | null;
  thumbnail: UploadTarget | null;
}

export const multipartPartsSchema = z.object({
  uploadId: z.string(),
  partNumbers: z.array(z.number().int().min(1).max(10000)).min(1).max(100),
});

export const completeUploadSchema = z.object({
  uploadId: z.string().optional(),
  parts: z.array(z.object({ partNumber: z.number().int(), etag: z.string() })).optional(),
});

export const updateMediaSchema = z.object({
  title: z.string().max(200).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  category: z.enum(MEDIA_CATEGORIES).optional(),
  date: partialDateSchema.nullable().optional(),
  place: z.string().max(300).nullable().optional(),
  albumId: z.string().nullable().optional(),
  personIds: z.array(z.string()).max(100).optional(),
});

export const mediaListQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  kind: z.enum(MEDIA_KINDS).optional(),
  albumId: z.string().optional(),
  personId: z.string().optional(),
  category: z.enum(MEDIA_CATEGORIES).optional(),
});

export interface MediaDto {
  id: string;
  treeId: string;
  albumId: string | null;
  kind: MediaKind;
  mimeType: string;
  size: number;
  originalName: string;
  title: string | null;
  description: string | null;
  category: MediaCategory;
  date: PartialDate | null;
  place: string | null;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  status: 'pending' | 'ready';
  personIds: string[];
  url: string | null;
  thumbnailUrl: string | null;
  uploadedBy: string;
  createdAt: number;
}

export const albumInputSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  coverMediaId: z.string().nullable().optional(),
});

export interface AlbumDto {
  id: string;
  treeId: string;
  title: string;
  description: string | null;
  coverMediaId: string | null;
  coverUrl: string | null;
  mediaCount: number;
  createdAt: number;
}

export const storyInputSchema = z.object({
  personId: z.string().nullable().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).nullable().optional(),
  body: z.string().max(50000).nullable().optional(),
  mediaId: z.string().nullable().optional(),
  date: partialDateSchema.nullable().optional(),
});

export interface StoryDto {
  id: string;
  treeId: string;
  personId: string | null;
  title: string;
  description: string | null;
  body: string | null;
  mediaId: string | null;
  media: MediaDto | null;
  date: PartialDate | null;
  createdBy: string;
  createdAt: number;
}
