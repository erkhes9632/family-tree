import { Hono } from 'hono';
import type { AppEnv } from '../env';
import { ApiError, badRequest, notFound } from '../lib/errors';
import { verify } from '../lib/hmac';
import { blobMessage, blobSigningSecret } from '../lib/storage';

/**
 * Signed blob endpoints used when R2 S3 credentials are not configured (local dev).
 * Every URL is minted by the API after an authorization check and carries an HMAC + expiry.
 */
export const blobRoutes = new Hono<AppEnv>();

async function check(secret: string, message: string, exp: string | undefined, sig: string | undefined) {
  if (!exp || !sig || Number(exp) * 1000 < Date.now()) throw new ApiError(403, 'expired', 'Link expired');
  if (!(await verify(secret, message, sig))) throw new ApiError(403, 'bad_signature', 'Invalid signature');
}

function parseRange(header: string | undefined): R2Range | undefined {
  const m = header?.match(/^bytes=(\d*)-(\d*)$/);
  if (!m) return undefined;
  if (m[1] === '' && m[2] !== '') return { suffix: Number(m[2]) };
  const offset = Number(m[1]);
  return m[2] === '' ? { offset } : { offset, length: Number(m[2]) - offset + 1 };
}

blobRoutes.get('/blob', async (c) => {
  const { k, exp, sig, dl } = c.req.query();
  if (!k) throw badRequest('missing key');
  await check(blobSigningSecret(c.env), blobMessage.get(k, Number(exp)), exp, sig);
  const range = parseRange(c.req.header('range'));
  const obj = await c.env.MEDIA.get(k, range ? { range } : undefined);
  if (!obj) throw notFound('File');
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('etag', obj.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', 'private, max-age=3600');
  if (dl) headers.set('content-disposition', `attachment; filename*=UTF-8''${encodeURIComponent(dl)}`);
  if (range && 'body' in obj && obj.range) {
    const r = obj.range as { offset?: number; length?: number; suffix?: number };
    const start = r.suffix != null ? obj.size - r.suffix : (r.offset ?? 0);
    const end = r.suffix != null ? obj.size - 1 : r.length != null ? start + r.length - 1 : obj.size - 1;
    headers.set('content-range', `bytes ${start}-${end}/${obj.size}`);
    headers.set('content-length', String(end - start + 1));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set('content-length', String(obj.size));
  return new Response(obj.body, { headers });
});

blobRoutes.put('/blob/upload', async (c) => {
  const { k, exp, ct, sig } = c.req.query();
  if (!k || !ct) throw badRequest('missing key');
  await check(blobSigningSecret(c.env), blobMessage.put(k, Number(exp), ct), exp, sig);
  if ((c.req.header('content-type') ?? '').split(';')[0] !== ct.split(';')[0]) throw badRequest('content-type mismatch');
  const body = c.req.raw.body;
  if (!body) throw badRequest('empty body');
  const obj = await c.env.MEDIA.put(k, body, { httpMetadata: { contentType: ct } });
  return c.json({ etag: obj?.etag });
});

blobRoutes.put('/blob/part', async (c) => {
  const { k, exp, u, n, sig } = c.req.query();
  if (!k || !u || !n) throw badRequest('missing params');
  await check(blobSigningSecret(c.env), blobMessage.part(k, Number(exp), u, Number(n)), exp, sig);
  const body = c.req.raw.body;
  if (!body) throw badRequest('empty body');
  const part = await c.env.MEDIA.resumeMultipartUpload(k, u).uploadPart(Number(n), body);
  c.header('ETag', `"${part.etag}"`);
  return c.json({ partNumber: part.partNumber, etag: part.etag });
});
