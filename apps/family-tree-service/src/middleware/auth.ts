import { verifyToken } from '@clerk/backend';
import { createMiddleware } from 'hono/factory';
import { sql } from 'drizzle-orm';
import { configured, type AppEnv } from '../env';
import { users } from '../db/schema';
import { unauthorized } from '../lib/errors';

const DEV_ID = /^[A-Za-z0-9_-]{1,64}$/;
/** user ids already ensured in this isolate (skip repeated upserts) */
const known = new Set<string>();

interface Identity {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
}

async function identify(env: AppEnv['Bindings'], header: string | undefined): Promise<Identity | null> {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice(7).trim();
  if (!token) return null;

  // Local development only: "Bearer dev:<userId>". Never enabled in production (AUTH_MODE=clerk).
  if (env.AUTH_MODE === 'dev' && token.startsWith('dev:')) {
    const id = token.slice(4);
    if (!DEV_ID.test(id)) return null;
    return { id, email: `${id}@dev.local`, name: id.replace(/^user_/, '').replace(/[_-]/g, ' '), image: null };
  }

  if (!configured(env.CLERK_JWT_KEY) && !configured(env.CLERK_SECRET_KEY)) return null;
  try {
    const payload = await verifyToken(token, {
      jwtKey: configured(env.CLERK_JWT_KEY) ? env.CLERK_JWT_KEY : undefined,
      secretKey: configured(env.CLERK_SECRET_KEY) ? env.CLERK_SECRET_KEY : undefined,
      authorizedParties: env.WEB_ORIGIN.split(',').map((s) => s.trim()),
    });
    // Optional custom session claims (Clerk dashboard → Sessions → customize session token):
    // { "email": "{{user.primary_email_address}}", "name": "{{user.full_name}}", "image": "{{user.image_url}}" }
    const claims = payload as unknown as Record<string, unknown>;
    const str = (k: string) => (typeof claims[k] === 'string' && claims[k] ? (claims[k] as string) : null);
    return { id: payload.sub, email: str('email'), name: str('name'), image: str('image') };
  } catch {
    return null;
  }
}

/** Resolves the caller (if any) and makes sure a `users` row exists for them. */
export const authenticate = createMiddleware<AppEnv>(async (c, next) => {
  const who = await identify(c.env, c.req.header('authorization'));
  c.set('userId', who?.id ?? null);
  if (who && !known.has(who.id)) {
    const db = c.get('db');
    await db
      .insert(users)
      .values({ id: who.id, email: who.email, displayName: who.name, imageUrl: who.image, timezone: c.env.DEFAULT_TIMEZONE })
      .onConflictDoUpdate({
        target: users.id,
        set: {
          email: sql`coalesce(${users.email}, excluded.email)`,
          displayName: sql`coalesce(${users.displayName}, excluded.display_name)`,
          imageUrl: sql`coalesce(${users.imageUrl}, excluded.image_url)`,
        },
      });
    known.add(who.id);
  }
  await next();
});

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get('userId')) throw unauthorized();
  await next();
});

/** The authenticated user id; only call behind requireAuth. */
export function uid(c: { get(key: 'userId'): string | null }): string {
  const id = c.get('userId');
  if (!id) throw unauthorized();
  return id;
}
