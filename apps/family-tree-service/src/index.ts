import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import type { AppEnv, Bindings } from './env';
import { createDb } from './db';
import { authenticate } from './middleware/auth';
import { ApiError } from './lib/errors';
import { treeRoutes } from './routes/trees';
import { invitationRoutes } from './routes/invitations';
import { personRoutes } from './routes/persons';
import { relationshipRoutes } from './routes/relationships';
import { eventRoutes } from './routes/events';
import { mediaRoutes } from './routes/media';
import { blobRoutes } from './routes/blob';
import { clanRoutes } from './routes/clans';
import { meRoutes } from './routes/me';
import { webhookRoutes } from './routes/webhooks';
import { runReminders } from './cron/reminders';

export const app = new Hono<AppEnv>();

app.use('*', secureHeaders({ crossOriginResourcePolicy: 'cross-origin' }));
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const allowed = (c.env as Bindings).WEB_ORIGIN.split(',').map((s) => s.trim());
      return allowed.includes(origin) ? origin : null;
    },
    allowHeaders: ['Authorization', 'Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposeHeaders: ['ETag'],
    maxAge: 86400,
  }),
);
app.use('*', async (c, next) => {
  c.set('db', createDb(c.env.DB));
  await next();
});

app.get('/', (c) => c.json({ name: 'family-tree-service', ok: true }));
app.get('/v1/health', async (c) => {
  await c.env.DB.prepare('select 1').first();
  return c.json({ ok: true, authMode: c.env.AUTH_MODE });
});

const v1 = new Hono<AppEnv>();
// signed blob & webhook endpoints authenticate by signature, not by user token
v1.route('/', blobRoutes);
v1.route('/', webhookRoutes);
v1.use('*', authenticate);
v1.route('/', meRoutes);
v1.route('/', clanRoutes);
v1.route('/', treeRoutes);
v1.route('/', invitationRoutes);
v1.route('/', personRoutes);
v1.route('/', relationshipRoutes);
v1.route('/', eventRoutes);
v1.route('/', mediaRoutes);

// Local testing: trigger the reminder job immediately (dev only).
v1.post('/dev/run-reminders', async (c) => {
  if (c.env.AUTH_MODE !== 'dev') return c.notFound();
  return c.json(await runReminders(c.env, c.get('db'), new Date(), { force: true }));
});

app.route('/v1', v1);

app.notFound((c) => c.json({ error: { code: 'not_found', message: 'Route not found' } }, 404));
app.onError((err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status);
  }
  if (err instanceof HTTPException) {
    return c.json({ error: { code: 'http_error', message: err.message } }, err.status);
  }
  const msg = String((err as Error)?.message ?? err);
  if (/UNIQUE constraint failed/i.test(msg)) return c.json({ error: { code: 'conflict', message: 'Already exists' } }, 409);
  if (/FOREIGN KEY constraint failed/i.test(msg)) return c.json({ error: { code: 'bad_reference', message: 'Referenced record does not exist' } }, 400);
  console.error('[unhandled]', err);
  return c.json({ error: { code: 'internal', message: 'Something went wrong' } }, 500);
});

export default {
  fetch: app.fetch,
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(
      runReminders(env, createDb(env.DB), new Date(controller.scheduledTime)).then((r) =>
        console.log(`[cron] reminders: users=${r.usersChecked} emails=${r.emails} pushes=${r.pushes}`),
      ),
    );
  },
} satisfies ExportedHandler<Bindings>;
