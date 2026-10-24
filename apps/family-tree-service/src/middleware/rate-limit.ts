import { createMiddleware } from 'hono/factory';
import type { AppEnv } from '../env';
import { tooMany } from '../lib/errors';

/** Per-user (or per-IP for anonymous callers) rate limit using a Workers rate-limit binding. */
export const rateLimit = (binding: 'INVITE_LIMITER' | 'UPLOAD_LIMITER') =>
  createMiddleware<AppEnv>(async (c, next) => {
    const limiter = c.env[binding] as RateLimit | undefined;
    if (limiter) {
      const who = c.get('userId') ?? c.req.header('cf-connecting-ip') ?? 'anonymous';
      const { success } = await limiter.limit({ key: `${binding}:${who}` });
      if (!success) throw tooMany();
    }
    await next();
  });
