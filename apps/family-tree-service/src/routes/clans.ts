import { Hono } from 'hono';
import { asc } from 'drizzle-orm';
import type { ClanDto } from '@super-project/types';
import type { AppEnv } from '../env';
import { clans } from '../db/schema';

export const clanRoutes = new Hono<AppEnv>();

clanRoutes.get('/clans', async (c) => {
  const rows = await c.get('db').select().from(clans).orderBy(asc(clans.nameMn));
  c.header('cache-control', 'public, max-age=3600');
  return c.json(rows.map((r): ClanDto => ({ id: r.id, slug: r.slug, nameMn: r.nameMn, nameEn: r.nameEn })));
});
