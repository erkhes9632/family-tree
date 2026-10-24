import { buildPushPayload, type PushSubscription, type VapidKeys } from '@block65/webcrypto-web-push';
import { eq } from 'drizzle-orm';
import { configured, type Bindings } from '../env';
import type { Database } from '../db';
import { pushSubscriptions } from '../db/schema';

export interface PushNotification {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export function pushConfigured(env: Bindings) {
  return configured(env.VAPID_PUBLIC_KEY) && configured(env.VAPID_PRIVATE_KEY);
}

/** Send to every subscription of a user; prunes subscriptions the push service reports as gone. */
export async function sendPushToUser(env: Bindings, db: Database, userId: string, n: PushNotification): Promise<number> {
  if (!pushConfigured(env)) {
    console.log(`[push:mock] user=${userId} ${n.title}: ${n.body}`);
    return 0;
  }
  const vapid: VapidKeys = {
    subject: configured(env.VAPID_SUBJECT) ? env.VAPID_SUBJECT : 'mailto:admin@example.com',
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
  let sent = 0;
  for (const s of subs) {
    const subscription: PushSubscription = { endpoint: s.endpoint, expirationTime: null, keys: { p256dh: s.p256dh, auth: s.auth } };
    try {
      const payload = await buildPushPayload({ data: JSON.stringify(n), options: { ttl: 24 * 3600 } }, subscription, vapid);
      const res = await fetch(s.endpoint, payload);
      if (res.status === 404 || res.status === 410) {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id));
      } else if (res.ok) {
        sent++;
      }
    } catch (err) {
      console.error('[push] failed', err);
    }
  }
  return sent;
}
