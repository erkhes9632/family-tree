'use client';
import {
  MEDIA_LIMITS,
  type CreateUploadInput,
  type CreateUploadResponse,
  type MediaDto,
  type MediaKind,
  type UploadTarget,
} from '@super-project/types';
import type { Api } from './api';

export function kindForMime(mime: string): MediaKind | null {
  if (mime.startsWith('image/')) return 'photo';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime === 'application/pdf') return 'document';
  return null;
}

export class UploadValidationError extends Error {
  constructor(readonly reason: 'type' | 'size', readonly maxMb?: number) {
    super(reason);
  }
}

export function validateFile(kind: MediaKind, file: { type: string; size: number }) {
  const limits = MEDIA_LIMITS[kind];
  const mime = file.type.split(';')[0].toLowerCase();
  if (!limits.mime.includes(mime)) throw new UploadValidationError('type');
  if (file.size > limits.maxBytes) throw new UploadValidationError('size', Math.round(limits.maxBytes / 1024 / 1024));
}

/** PUT with progress via XHR (fetch has no upload progress). Returns the ETag header if exposed. */
function put(target: UploadTarget, body: Blob, onProgress?: (loaded: number) => void): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(target.method, target.url);
    for (const [k, v] of Object.entries(target.headers)) xhr.setRequestHeader(k, v);
    xhr.upload.onprogress = (e) => onProgress?.(e.loaded);
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve(xhr.getResponseHeader('ETag')) : reject(new Error(`Upload failed (${xhr.status})`)));
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(body);
  });
}

async function imageThumbnail(file: Blob): Promise<{ blob: Blob; width: number; height: number } | null> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 480 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext('2d')?.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.82));
    const out = blob ? { blob, width: bmp.width, height: bmp.height } : null;
    bmp.close();
    return out;
  } catch {
    return null; // e.g. HEIC in browsers without support
  }
}

async function videoThumbnail(file: Blob): Promise<{ blob: Blob; width: number; height: number; duration: number } | null> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.preload = 'metadata';
    video.src = url;
    await new Promise<void>((res, rej) => {
      video.onloadeddata = () => res();
      video.onerror = () => rej(new Error('video'));
    });
    video.currentTime = Math.min(1, (video.duration || 2) / 2);
    await new Promise<void>((res) => (video.onseeked = () => res()));
    const scale = Math.min(1, 480 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.8));
    return blob ? { blob, width: video.videoWidth, height: video.videoHeight, duration: video.duration } : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function audioDuration(file: Blob): Promise<number | null> {
  const url = URL.createObjectURL(file);
  try {
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = url;
    const d = await new Promise<number>((res) => {
      audio.onloadedmetadata = () => res(audio.duration);
      audio.onerror = () => res(NaN);
    });
    return Number.isFinite(d) ? d : null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export interface UploadMeta extends Omit<CreateUploadInput, 'kind' | 'fileName' | 'mimeType' | 'size' | 'withThumbnail' | 'category' | 'personIds'> {
  category?: CreateUploadInput['category'];
  personIds?: string[];
}

/**
 * Full upload flow: thumbnail → create media row → upload directly to storage
 * (single PUT or multipart) → upload thumbnail → mark complete.
 */
export async function uploadMedia(
  api: Api,
  treeId: string,
  file: File | Blob,
  opts: { kind?: MediaKind; fileName?: string; meta?: UploadMeta; onProgress?: (fraction: number) => void; durationSec?: number },
): Promise<MediaDto> {
  const mime = file.type || 'application/octet-stream';
  const kind = opts.kind ?? kindForMime(mime);
  if (!kind) throw new UploadValidationError('type');
  validateFile(kind, file);

  let thumb: Blob | null = null;
  let width: number | null = null;
  let height: number | null = null;
  let duration: number | null = opts.durationSec ?? null;
  if (mime.startsWith('image/')) {
    const r = await imageThumbnail(file);
    if (r) ({ blob: thumb, width, height } = r);
  } else if (kind === 'video') {
    const r = await videoThumbnail(file);
    if (r) ({ blob: thumb, width, height, duration } = r);
  } else if (kind === 'audio' && duration == null) {
    duration = await audioDuration(file);
  }

  const fileName = opts.fileName ?? (file instanceof File ? file.name : `recording.${mime.includes('mp4') ? 'm4a' : 'webm'}`);
  const created = await api.post<CreateUploadResponse>(`/trees/${treeId}/media/uploads`, {
    kind,
    fileName,
    mimeType: mime,
    size: file.size,
    withThumbnail: !!thumb,
    width,
    height,
    durationSec: duration,
    category: opts.meta?.category ?? 'other',
    personIds: opts.meta?.personIds ?? [],
    ...opts.meta,
  });

  const total = file.size;
  if (created.upload) {
    await put(created.upload, file, (n) => opts.onProgress?.(n / total));
  } else if (created.multipart) {
    const { uploadId, partSize, partCount } = created.multipart;
    const loaded = new Array<number>(partCount).fill(0);
    const parts: { partNumber: number; etag: string }[] = [];
    const numbers = Array.from({ length: partCount }, (_, i) => i + 1);
    const batches: number[][] = [];
    for (let i = 0; i < numbers.length; i += 20) batches.push(numbers.slice(i, i + 20));
    for (const batch of batches) {
      const { parts: targets } = await api.post<{ parts: (UploadTarget & { partNumber: number })[] }>(`/trees/${treeId}/media/${created.media.id}/parts`, { uploadId, partNumbers: batch });
      // three parts in flight at a time
      let next = 0;
      const worker = async () => {
        while (next < targets.length) {
          const target = targets[next++];
          const start = (target.partNumber - 1) * partSize;
          const blob = file.slice(start, Math.min(start + partSize, total));
          const etag = await put(target, blob, (n) => {
            loaded[target.partNumber - 1] = n;
            opts.onProgress?.(loaded.reduce((a, b) => a + b, 0) / total);
          });
          if (!etag) throw new Error('Storage did not return an ETag (check bucket CORS ExposeHeaders)');
          parts.push({ partNumber: target.partNumber, etag: etag.replace(/"/g, '') });
        }
      };
      await Promise.all([worker(), worker(), worker()]);
    }
    if (thumb && created.thumbnail) await put(created.thumbnail, thumb).catch(() => null);
    return api.post<MediaDto>(`/trees/${treeId}/media/${created.media.id}/complete`, { uploadId, parts });
  }
  if (thumb && created.thumbnail) await put(created.thumbnail, thumb).catch(() => null);
  return api.post<MediaDto>(`/trees/${treeId}/media/${created.media.id}/complete`, {});
}
