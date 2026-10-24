import { Hono } from 'hono';
import { verifyWebhook } from '@clerk/backend/webhooks';
import { eq } from 'drizzle-orm';
import { configured, type AppEnv } from '../env';
import { users } from '../db/schema';
import { ApiError } from '../lib/errors';

/** Clerk → D1 user sync. Clerk signs webhooks with Svix (Standard Webhooks); verified here. */
export const webhookRoutes = new Hono<AppEnv>();

webhookRoutes.post('/webhooks/clerk', async (c) => {
  if (!configured(c.env.CLERK_WEBHOOK_SECRET)) throw new ApiError(503, 'not_configured', 'Webhook secret not configured');
  let evt;
  try {
    evt = await verifyWebhook(c.req.raw, { signingSecret: c.env.CLERK_WEBHOOK_SECRET });
  } catch {
    throw new ApiError(400, 'bad_signature', 'Invalid webhook signature');
  }
  const db = c.get('db');
  if (evt.type === 'user.created' || evt.type === 'user.updated') {
    const u = evt.data;
    const email = u.email_addresses.find((e) => e.id === u.primary_email_address_id)?.email_address ?? u.email_addresses[0]?.email_address ?? null;
    const displayName = [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || null;
    await db
      .insert(users)
      .values({ id: u.id, email, displayName, imageUrl: u.image_url ?? null, timezone: c.env.DEFAULT_TIMEZONE })
      .onConflictDoUpdate({ target: users.id, set: { email, displayName, imageUrl: u.image_url ?? null, deletedAt: null } });
  } else if (evt.type === 'user.deleted' && evt.data.id) {
    // keep authorship in history, drop personal data
    await db.update(users).set({ deletedAt: Date.now(), email: null, imageUrl: null }).where(eq(users.id, evt.data.id));
  }
  return c.json({ ok: true });
});
