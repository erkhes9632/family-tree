import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import { eventInputSchema, type PartialDate, type TimelineEntry } from '@super-project/types';
import type { AppEnv } from '../env';
import { events, partnerships, persons } from '../db/schema';
import { requireAuth, uid } from '../middleware/auth';
import { auditQuery } from '../lib/audit';
import { badRequest, notFound } from '../lib/errors';
import { dateCols, toEventDto, toPartialDate, toPartnershipDto } from '../lib/mappers';
import { requireTree } from '../lib/tree-access';
import { v } from '../lib/validate';

export const eventRoutes = new Hono<AppEnv>();

eventRoutes.get('/trees/:treeId/events', async (c) => {
  const db = c.get('db');
  const { tree } = await requireTree(db, c.req.param('treeId'), c.get('userId'), 'view');
  const personId = c.req.query('personId');
  const rows = await db
    .select()
    .from(events)
    .where(and(eq(events.treeId, tree.id), personId ? eq(events.personId, personId) : undefined))
    .orderBy(asc(events.dateYear), asc(events.dateMonth), asc(events.dateDay));
  return c.json(rows.map(toEventDto));
});

/** Merged, chronologically sortable timeline: stored events + births, deaths and marriages. */
eventRoutes.get('/trees/:treeId/timeline', async (c) => {
  const db = c.get('db');
  const { tree, access } = await requireTree(db, c.req.param('treeId'), c.get('userId'), 'view');
  const [ps, pts, evs] = await db.batch([
    db.select().from(persons).where(eq(persons.treeId, tree.id)),
    db.select().from(partnerships).where(eq(partnerships.treeId, tree.id)),
    db.select().from(events).where(eq(events.treeId, tree.id)),
  ]);
  const living = new Map(ps.map((p) => [p.id, p.isLiving]));
  const hide = (d: PartialDate, personIds: string[]): PartialDate =>
    access.restricted && personIds.some((id) => living.get(id)) ? { year: d.year, month: null, day: null, qualifier: d.qualifier } : d;

  const out: TimelineEntry[] = [];
  for (const p of ps) {
    const birth = toPartialDate({ year: p.birthYear, month: p.birthMonth, day: p.birthDay, qualifier: p.birthQualifier });
    if (birth) out.push({ key: `b:${p.id}`, source: 'person', type: 'birth', date: hide(birth, [p.id]), personIds: [p.id], title: null, description: null, eventId: null });
    const death = toPartialDate({ year: p.deathYear, month: p.deathMonth, day: p.deathDay, qualifier: p.deathQualifier });
    if (death && !p.isLiving) out.push({ key: `d:${p.id}`, source: 'person', type: 'death', date: death, personIds: [p.id], title: null, description: null, eventId: null });
  }
  for (const pt of pts.map(toPartnershipDto)) {
    const ids = [pt.person1Id, pt.person2Id];
    if (pt.startDate && pt.status !== 'partner') out.push({ key: `m:${pt.id}`, source: 'partnership', type: 'marriage', date: hide(pt.startDate, ids), personIds: ids, title: null, description: null, eventId: null });
    if (pt.endDate && pt.status === 'divorced') out.push({ key: `x:${pt.id}`, source: 'partnership', type: 'divorce', date: hide(pt.endDate, ids), personIds: ids, title: null, description: null, eventId: null });
  }
  for (const e of evs) {
    const d = toEventDto(e);
    if (!d.date) continue;
    const ids = d.personId ? [d.personId] : [];
    out.push({ key: `e:${e.id}`, source: 'event', type: d.type, date: hide(d.date, ids), personIds: ids, title: d.title, description: d.description, eventId: e.id });
  }
  return c.json(out);
});

async function checkRefs(db: AppEnv['Variables']['db'], treeId: string, personId?: string | null, partnershipId?: string | null) {
  if (personId && !(await db.query.persons.findFirst({ where: and(eq(persons.id, personId), eq(persons.treeId, treeId)) }))) {
    throw badRequest('personId is not in this tree');
  }
  if (partnershipId && !(await db.query.partnerships.findFirst({ where: and(eq(partnerships.id, partnershipId), eq(partnerships.treeId, treeId)) }))) {
    throw badRequest('partnershipId is not in this tree');
  }
}

eventRoutes.post('/trees/:treeId/events', requireAuth, v('json', eventInputSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const { date, ...body } = c.req.valid('json');
  await checkRefs(db, tree.id, body.personId, body.partnershipId);
  const [[row]] = await db.batch([
    db.insert(events).values({ ...body, ...dateCols('date', date), treeId: tree.id, createdBy: me }).returning(),
  ]);
  await auditQuery(db, { treeId: tree.id, userId: me, entityType: 'event', entityId: row.id, action: 'create', after: c.req.valid('json'), summary: body.title ?? body.type });
  return c.json(toEventDto(row), 201);
});

eventRoutes.patch('/trees/:treeId/events/:id', requireAuth, v('json', eventInputSchema.partial()), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const ev = await db.query.events.findFirst({ where: and(eq(events.id, c.req.param('id')), eq(events.treeId, tree.id)) });
  if (!ev) throw notFound('Event');
  const body = c.req.valid('json');
  const { date, ...rest } = body;
  await checkRefs(db, tree.id, rest.personId, rest.partnershipId);
  const [row] = await db
    .update(events)
    .set({ ...rest, ...('date' in body ? dateCols('date', date) : {}) })
    .where(eq(events.id, ev.id))
    .returning();
  await auditQuery(db, { treeId: tree.id, userId: me, entityType: 'event', entityId: ev.id, action: 'update', before: toEventDto(ev), after: toEventDto(row) });
  return c.json(toEventDto(row));
});

eventRoutes.delete('/trees/:treeId/events/:id', requireAuth, async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const ev = await db.query.events.findFirst({ where: and(eq(events.id, c.req.param('id')), eq(events.treeId, tree.id)) });
  if (!ev) throw notFound('Event');
  await db.batch([
    db.delete(events).where(eq(events.id, ev.id)),
    auditQuery(db, { treeId: tree.id, userId: me, entityType: 'event', entityId: ev.id, action: 'delete', before: toEventDto(ev) }),
  ]);
  return c.body(null, 204);
});
