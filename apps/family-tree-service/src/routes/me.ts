import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { todayInTimeZone } from '@super-project/genealogy';
import {
  notificationPrefsSchema,
  pushSubscriptionSchema,
  REMINDER_KINDS,
  updateMeSchema,
  type MeResponse,
  type NotificationPrefs,
} from '@super-project/types';
import { z } from 'zod';
import { configured, type AppEnv } from '../env';
import { notificationPrefs, pushSubscriptions, treeMembers, trees, users } from '../db/schema';
import { requireAuth, uid } from '../middleware/auth';
import { notFound } from '../lib/errors';
import { v } from '../lib/validate';
import { upcomingForUser } from '../cron/reminders';

export const meRoutes = new Hono<AppEnv>();

meRoutes.get('/push/public-key', (c) => c.json({ publicKey: configured(c.env.VAPID_PUBLIC_KEY) ? c.env.VAPID_PUBLIC_KEY : null }));

meRoutes.use('/me', requireAuth);
meRoutes.use('/me/*', requireAuth);

meRoutes.get('/me', async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const user = await db.query.users.findFirst({ where: eq(users.id, me) });
  if (!user) throw notFound('User');
  const memberships = await db
    .select({ treeId: treeMembers.treeId, treeName: trees.name, role: treeMembers.role, personId: treeMembers.personId })
    .from(treeMembers)
    .innerJoin(trees, eq(trees.id, treeMembers.treeId))
    .where(eq(treeMembers.userId, me));
  const res: MeResponse = {
    user: { id: user.id, email: user.email, displayName: user.displayName, imageUrl: user.imageUrl, locale: user.locale, timezone: user.timezone },
    memberships,
  };
  return c.json(res);
});

meRoutes.patch('/me', v('json', updateMeSchema), async (c) => {
  const db = c.get('db');
  const body = c.req.valid('json');
  if (body.timezone) {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: body.timezone });
    } catch {
      delete body.timezone;
    }
  }
  await db.update(users).set(body).where(eq(users.id, uid(c)));
  return c.json({ ok: true });
});

meRoutes.get('/me/notification-prefs', async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const row = await db.query.notificationPrefs.findFirst({ where: eq(notificationPrefs.userId, me) });
  const user = await db.query.users.findFirst({ where: eq(users.id, me) });
  const subs = await db.select({ id: pushSubscriptions.id }).from(pushSubscriptions).where(eq(pushSubscriptions.userId, me));
  const prefs: NotificationPrefs = row
    ? { emailEnabled: row.emailEnabled, pushEnabled: row.pushEnabled, daysBefore: row.daysBefore, kinds: row.kinds, timezone: row.timezone }
    : { emailEnabled: true, pushEnabled: false, daysBefore: 1, kinds: [...REMINDER_KINDS], timezone: user?.timezone ?? c.env.DEFAULT_TIMEZONE };
  return c.json({ ...prefs, pushSubscriptions: subs.length, emailAddress: user?.email ?? null });
});

meRoutes.put('/me/notification-prefs', v('json', notificationPrefsSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const body = c.req.valid('json');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: body.timezone });
  } catch {
    body.timezone = c.env.DEFAULT_TIMEZONE;
  }
  await db.batch([
    db.insert(notificationPrefs).values({ userId: me, ...body }).onConflictDoUpdate({ target: notificationPrefs.userId, set: body }),
    db.update(users).set({ timezone: body.timezone }).where(eq(users.id, me)),
  ]);
  return c.json(body);
});

meRoutes.post('/me/push-subscriptions', v('json', pushSubscriptionSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const s = c.req.valid('json');
  await db
    .insert(pushSubscriptions)
    .values({ userId: me, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { userId: me, p256dh: s.keys.p256dh, auth: s.keys.auth } });
  return c.json({ ok: true }, 201);
});

meRoutes.delete('/me/push-subscriptions', v('json', z.object({ endpoint: z.string() })), async (c) => {
  const db = c.get('db');
  await db.delete(pushSubscriptions).where(and(eq(pushSubscriptions.userId, uid(c)), eq(pushSubscriptions.endpoint, c.req.valid('json').endpoint)));
  return c.body(null, 204);
});

meRoutes.get('/me/upcoming', v('query', z.object({ days: z.coerce.number().int().min(0).max(60).default(30) })), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const user = await db.query.users.findFirst({ where: eq(users.id, me) });
  const today = todayInTimeZone(user?.timezone ?? c.env.DEFAULT_TIMEZONE);
  const items = await upcomingForUser(db, me, today, c.req.valid('query').days);
  return c.json(items.slice(0, 50));
});
