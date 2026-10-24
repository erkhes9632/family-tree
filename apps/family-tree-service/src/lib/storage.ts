import { AwsClient } from 'aws4fetch';
import type { UploadTarget } from '@super-project/types';
import { configured, type Bindings } from '../env';
import { sign } from './hmac';

const URL_TTL_SEC = 2 * 60 * 60;
const UPLOAD_TTL_SEC = 60 * 60;

/** Signing windows are aligned to the hour so repeated reads yield cacheable, identical URLs. */
function hourBucket(now = Date.now()) {
  return Math.floor(now / 3_600_000) * 3_600_000;
}

export interface Storage {
  readonly mode: 's3' | 'worker';
  putTarget(key: string, contentType: string): Promise<UploadTarget>;
  getUrl(key: string, opts?: { download?: string }): Promise<string>;
  createMultipart(key: string, contentType: string): Promise<string>;
  partTarget(key: string, uploadId: string, partNumber: number): Promise<UploadTarget>;
  completeMultipart(key: string, uploadId: string, parts: { partNumber: number; etag: string }[]): Promise<void>;
  abortMultipart(key: string, uploadId: string): Promise<void>;
}

export function blobSigningSecret(env: Bindings) {
  return configured(env.BLOB_SIGNING_SECRET) ? env.BLOB_SIGNING_SECRET : 'dev-only-insecure-secret';
}

/** Messages signed for Worker blob URLs; the blob route verifies the same strings. */
export const blobMessage = {
  get: (key: string, exp: number) => `GET\n${key}\n${exp}`,
  put: (key: string, exp: number, contentType: string) => `PUT\n${key}\n${exp}\n${contentType}`,
  part: (key: string, exp: number, uploadId: string, part: number) => `PART\n${key}\n${exp}\n${uploadId}\n${part}`,
};

export function createStorage(env: Bindings): Storage {
  if (configured(env.R2_ACCOUNT_ID) && configured(env.R2_ACCESS_KEY_ID) && configured(env.R2_SECRET_ACCESS_KEY)) {
    return s3Storage(env);
  }
  return workerStorage(env);
}

/** Direct browser ↔ R2 via presigned S3 URLs (production). */
function s3Storage(env: Bindings): Storage {
  const aws = new AwsClient({
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  });
  const base = `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${env.R2_BUCKET_NAME}`;
  const objectUrl = (key: string) => new URL(`${base}/${key.split('/').map(encodeURIComponent).join('/')}`);
  const amzDate = (ms: number) => new Date(ms).toISOString().replace(/[:-]|\.\d{3}/g, '');

  async function presign(method: string, url: URL, ttl: number, headers: Record<string, string> = {}, aligned = false) {
    url.searchParams.set('X-Amz-Expires', String(ttl));
    const signed = await aws.sign(new Request(url, { method, headers }), {
      aws: { signQuery: true, ...(aligned ? { datetime: amzDate(hourBucket()) } : {}) },
    });
    return signed.url;
  }

  return {
    mode: 's3',
    async putTarget(key, contentType) {
      const headers = { 'Content-Type': contentType };
      return { url: await presign('PUT', objectUrl(key), UPLOAD_TTL_SEC, headers), method: 'PUT', headers };
    },
    async getUrl(key, opts) {
      const url = objectUrl(key);
      if (opts?.download) url.searchParams.set('response-content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(opts.download)}`);
      return presign('GET', url, URL_TTL_SEC, {}, true);
    },
    async createMultipart(key, contentType) {
      const url = objectUrl(key);
      url.search = 'uploads';
      const res = await aws.fetch(url, { method: 'POST', headers: { 'Content-Type': contentType } });
      const text = await res.text();
      const id = text.match(/<UploadId>([^<]+)<\/UploadId>/)?.[1];
      if (!res.ok || !id) throw new Error(`R2 createMultipart failed: ${res.status}`);
      return id;
    },
    async partTarget(key, uploadId, partNumber) {
      const url = objectUrl(key);
      url.searchParams.set('partNumber', String(partNumber));
      url.searchParams.set('uploadId', uploadId);
      return { url: await presign('PUT', url, UPLOAD_TTL_SEC * 6), method: 'PUT', headers: {} };
    },
    async completeMultipart(key, uploadId, parts) {
      const url = objectUrl(key);
      url.searchParams.set('uploadId', uploadId);
      const body =
        '<CompleteMultipartUpload>' +
        [...parts]
          .sort((a, b) => a.partNumber - b.partNumber)
          .map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>"${p.etag.replace(/"/g, '')}"</ETag></Part>`)
          .join('') +
        '</CompleteMultipartUpload>';
      const res = await aws.fetch(url, { method: 'POST', body });
      if (!res.ok) throw new Error(`R2 completeMultipart failed: ${res.status} ${await res.text()}`);
    },
    async abortMultipart(key, uploadId) {
      const url = objectUrl(key);
      url.searchParams.set('uploadId', uploadId);
      await aws.fetch(url, { method: 'DELETE' });
    },
  };
}

/** Uploads/downloads through signed Worker URLs backed by the R2 binding (local dev, or no S3 keys). */
function workerStorage(env: Bindings): Storage {
  const secret = blobSigningSecret(env);
  const origin = env.API_ORIGIN.replace(/\/$/, '');
  const exp = (ttl: number, aligned = false) => Math.floor(((aligned ? hourBucket() : Date.now()) + ttl * 1000) / 1000);

  return {
    mode: 'worker',
    async putTarget(key, contentType) {
      const e = exp(UPLOAD_TTL_SEC);
      const sig = await sign(secret, blobMessage.put(key, e, contentType));
      const qs = new URLSearchParams({ k: key, exp: String(e), ct: contentType, sig });
      return { url: `${origin}/v1/blob/upload?${qs}`, method: 'PUT', headers: { 'Content-Type': contentType } };
    },
    async getUrl(key, opts) {
      const e = exp(URL_TTL_SEC, true);
      const sig = await sign(secret, blobMessage.get(key, e));
      const qs = new URLSearchParams({ k: key, exp: String(e), sig });
      if (opts?.download) qs.set('dl', opts.download);
      return `${origin}/v1/blob?${qs}`;
    },
    async createMultipart(key, contentType) {
      const upload = await env.MEDIA.createMultipartUpload(key, { httpMetadata: { contentType } });
      return upload.uploadId;
    },
    async partTarget(key, uploadId, partNumber) {
      const e = exp(UPLOAD_TTL_SEC * 6);
      const sig = await sign(secret, blobMessage.part(key, e, uploadId, partNumber));
      const qs = new URLSearchParams({ k: key, exp: String(e), u: uploadId, n: String(partNumber), sig });
      return { url: `${origin}/v1/blob/part?${qs}`, method: 'PUT', headers: {} };
    },
    async completeMultipart(key, uploadId, parts) {
      const upload = env.MEDIA.resumeMultipartUpload(key, uploadId);
      await upload.complete([...parts].sort((a, b) => a.partNumber - b.partNumber).map((p) => ({ partNumber: p.partNumber, etag: p.etag.replace(/"/g, '') })));
    },
    async abortMultipart(key, uploadId) {
      await env.MEDIA.resumeMultipartUpload(key, uploadId).abort();
    },
  };
}
