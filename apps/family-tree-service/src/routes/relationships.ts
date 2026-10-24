import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { parentChildInputSchema, parentChildUpdateSchema, partnershipInputSchema, partnershipUpdateSchema } from '@super-project/types';
import type { AppEnv } from '../env';
import { parentChild, partnerships, trees } from '../db/schema';
import { requireAuth, uid } from '../middleware/auth';
import { auditQuery } from '../lib/audit';
import { badRequest, conflict, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { dateCols, toPartnershipDto } from '../lib/mappers';
import { requireTree } from '../lib/tree-access';
import { v } from '../lib/validate';
import { loadIndex } from './persons';

export const relationshipRoutes = new Hono<AppEnv>();

relationshipRoutes.post('/trees/:treeId/parent-child', requireAuth, v('json', parentChildInputSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const body = c.req.valid('json');
  const idx = await loadIndex(db, tree.id);
  if (!idx.get(body.parentId) || !idx.get(body.childId)) throw badRequest('Both people must be in this tree');
  if (idx.parents(body.childId).some((p) => p.id === body.parentId)) throw conflict('That link already exists');
  if (idx.wouldCreateCycle(body.parentId, body.childId)) throw conflict('That link would make someone their own ancestor');
  const id = newId();
  await db.batch([
    db.insert(parentChild).values({ id, treeId: tree.id, ...body }),
    auditQuery(db, { treeId: tree.id, userId: me, entityType: 'parent_child', entityId: id, action: 'create', after: body }),
    db.update(trees).set({ updatedAt: Date.now() }).where(eq(trees.id, tree.id)),
  ]);
  return c.json({ id, ...body }, 201);
});

relationshipRoutes.patch('/trees/:treeId/parent-child/:id', requireAuth, v('json', parentChildUpdateSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const link = await db.query.parentChild.findFirst({ where: and(eq(parentChild.id, c.req.param('id')), eq(parentChild.treeId, tree.id)) });
  if (!link) throw notFound('Link');
  const { type } = c.req.valid('json');
  await db.batch([
    db.update(parentChild).set({ type }).where(eq(parentChild.id, link.id)),
    auditQuery(db, { treeId: tree.id, userId: me, entityType: 'parent_child', entityId: link.id, action: 'update', before: { type: link.type }, after: { type } }),
  ]);
  return c.json({ ...link, type });
});

relationshipRoutes.delete('/trees/:treeId/parent-child/:id', requireAuth, async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const link = await db.query.parentChild.findFirst({ where: and(eq(parentChild.id, c.req.param('id')), eq(parentChild.treeId, tree.id)) });
  if (!link) throw notFound('Link');
  await db.batch([
    db.delete(parentChild).where(eq(parentChild.id, link.id)),
    auditQuery(db, { treeId: tree.id, userId: me, entityType: 'parent_child', entityId: link.id, action: 'delete', before: { parentId: link.parentId, childId: link.childId, type: link.type } }),
  ]);
  return c.body(null, 204);
});

relationshipRoutes.post('/trees/:treeId/partnerships', requireAuth, v('json', partnershipInputSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const { startDate, endDate, ...body } = c.req.valid('json');
  if (body.person1Id === body.person2Id) throw badRequest('A person cannot partner with themselves');
  const idx = await loadIndex(db, tree.id);
  if (!idx.get(body.person1Id) || !idx.get(body.person2Id)) throw badRequest('Both people must be in this tree');
  const id = newId();
  const values = {
    id,
    treeId: tree.id,
    ...body,
    sortOrder: body.sortOrder ?? idx.partnerships(body.person1Id).length,
    ...dateCols('start', startDate),
    ...dateCols('end', endDate),
  };
  const [[row]] = await db.batch([
    db.insert(partnerships).values(values).returning(),
    auditQuery(db, { treeId: tree.id, userId: me, entityType: 'partnership', entityId: id, action: 'create', after: c.req.valid('json') }),
    db.update(trees).set({ updatedAt: Date.now() }).where(eq(trees.id, tree.id)),
  ]);
  return c.json(toPartnershipDto(row), 201);
});

relationshipRoutes.patch('/trees/:treeId/partnerships/:id', requireAuth, v('json', partnershipUpdateSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const pt = await db.query.partnerships.findFirst({ where: and(eq(partnerships.id, c.req.param('id')), eq(partnerships.treeId, tree.id)) });
  if (!pt) throw notFound('Partnership');
  const body = c.req.valid('json');
  const { startDate, endDate, ...rest } = body;
  const values = {
    ...rest,
    ...('startDate' in body ? dateCols('start', startDate) : {}),
    ...('endDate' in body ? dateCols('end', endDate) : {}),
  };
  const before = toPartnershipDto(pt);
  const [[row]] = await db.batch([
    db.update(partnerships).set(values).where(eq(partnerships.id, pt.id)).returning(),
    auditQuery(db, { treeId: tree.id, userId: me, entityType: 'partnership', entityId: pt.id, action: 'update', before: Object.fromEntries(Object.keys(body).map((k) => [k, (before as unknown as Record<string, unknown>)[k]])), after: body }),
  ]);
  return c.json(toPartnershipDto(row));
});

relationshipRoutes.delete('/trees/:treeId/partnerships/:id', requireAuth, async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const pt = await db.query.partnerships.findFirst({ where: and(eq(partnerships.id, c.req.param('id')), eq(partnerships.treeId, tree.id)) });
  if (!pt) throw notFound('Partnership');
  await db.batch([
    db.delete(partnerships).where(eq(partnerships.id, pt.id)),
    auditQuery(db, { treeId: tree.id, userId: me, entityType: 'partnership', entityId: pt.id, action: 'delete', before: toPartnershipDto(pt) }),
  ]);
  return c.body(null, 204);
});
