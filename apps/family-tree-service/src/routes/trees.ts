import { Hono } from 'hono';
import { and, count, desc, eq, lt, or, sql } from 'drizzle-orm';
import {
  createTreeSchema,
  decideFriendSchema,
  paginationQuerySchema,
  updateMemberSchema,
  updateTreeSchema,
  type AuditEntryDto,
  type FriendRequestDto,
  type MemberDto,
  type TreeGraph,
  type TreeWithAccess,
} from '@super-project/types';
import type { AppEnv } from '../env';
import { auditLog, friendAccess, media, parentChild, partnerships, persons, treeMembers, trees, users } from '../db/schema';
import { requireAuth, uid } from '../middleware/auth';
import { auditQuery } from '../lib/audit';
import { badRequest, conflict, forbidden, notFound } from '../lib/errors';
import { newId } from '../lib/ids';
import { personValues, toPartnershipDto, toPersonSummary, toTreeDto } from '../lib/mappers';
import { redactSummary } from '../lib/privacy';
import { createStorage } from '../lib/storage';
import { loadTreeAccess, requireTree } from '../lib/tree-access';
import { v } from '../lib/validate';

export const treeRoutes = new Hono<AppEnv>();

/** Trees the caller belongs to. */
treeRoutes.get('/trees', requireAuth, async (c) => {
  const db = c.get('db');
  const rows = await db
    .select({
      tree: trees,
      role: treeMembers.role,
      personId: treeMembers.personId,
      personCount: sql<number>`(select count(*) from ${persons} where ${persons.treeId} = ${trees.id})`,
    })
    .from(treeMembers)
    .innerJoin(trees, eq(trees.id, treeMembers.treeId))
    .where(eq(treeMembers.userId, uid(c)))
    .orderBy(desc(trees.updatedAt));
  return c.json(rows.map((r) => ({ ...toTreeDto(r.tree, r.personCount), role: r.role, personId: r.personId })));
});

/** Public trees, for discovery (no auth needed). */
treeRoutes.get('/public-trees', v('query', paginationQuerySchema), async (c) => {
  const db = c.get('db');
  const { cursor, limit } = c.req.valid('query');
  const rows = await db
    .select({ tree: trees, personCount: sql<number>`(select count(*) from ${persons} where ${persons.treeId} = ${trees.id})` })
    .from(trees)
    .where(and(eq(trees.privacy, 'public'), cursor ? lt(trees.createdAt, Number(cursor)) : undefined))
    .orderBy(desc(trees.createdAt))
    .limit(limit + 1);
  const items = rows.slice(0, limit).map((r) => toTreeDto(r.tree, r.personCount));
  return c.json({ items, nextCursor: rows.length > limit ? String(items[items.length - 1].createdAt) : null });
});

treeRoutes.post('/trees', requireAuth, v('json', createTreeSchema), async (c) => {
  const db = c.get('db');
  const userId = uid(c);
  const { self, ...input } = c.req.valid('json');
  const treeId = newId();
  const personId = self ? newId() : null;
  const stmts = [
    db.insert(trees).values({ id: treeId, ...input, ownerId: userId, rootPersonId: personId }),
    db.insert(treeMembers).values({ treeId, userId, role: 'admin', personId }),
    auditQuery(db, { treeId, userId, entityType: 'tree', entityId: treeId, action: 'create', after: input, summary: input.name }),
  ] as const;
  if (self && personId) {
    await db.batch([
      ...stmts,
      db.insert(persons).values({ ...personValues(self), givenName: self.givenName, id: personId, treeId, userId, createdBy: userId }),
    ]);
  } else {
    await db.batch(stmts);
  }
  const ctx = await loadTreeAccess(db, treeId, userId);
  return c.json({ ...toTreeDto(ctx.tree, self ? 1 : 0), access: ctx.access } satisfies TreeWithAccess, 201);
});

treeRoutes.get('/trees/:treeId', async (c) => {
  const db = c.get('db');
  const { tree, access } = await requireTree(db, c.req.param('treeId'), c.get('userId'), 'view');
  const [{ n }] = await db.select({ n: count() }).from(persons).where(eq(persons.treeId, tree.id));
  return c.json({ ...toTreeDto(tree, n), access } satisfies TreeWithAccess);
});

treeRoutes.patch('/trees/:treeId', requireAuth, v('json', updateTreeSchema), async (c) => {
  const db = c.get('db');
  const { tree } = await requireTree(db, c.req.param('treeId'), uid(c), 'manage');
  const body = c.req.valid('json');
  if (body.rootPersonId) {
    const p = await db.query.persons.findFirst({ where: and(eq(persons.id, body.rootPersonId), eq(persons.treeId, tree.id)) });
    if (!p) throw badRequest('rootPersonId is not in this tree');
  }
  const [updated] = await db.batch([
    db.update(trees).set(body).where(eq(trees.id, tree.id)).returning(),
    auditQuery(db, { treeId: tree.id, userId: uid(c), entityType: 'tree', entityId: tree.id, action: 'update', before: pick(tree, body), after: body }),
  ]);
  return c.json(toTreeDto(updated[0]));
});

treeRoutes.delete('/trees/:treeId', requireAuth, async (c) => {
  const db = c.get('db');
  const { tree } = await requireTree(db, c.req.param('treeId'), uid(c), 'manage');
  await db.delete(trees).where(eq(trees.id, tree.id));
  // Remove the tree's files in the background.
  c.executionCtx.waitUntil(deletePrefix(c.env.MEDIA, `trees/${tree.id}/`));
  return c.body(null, 204);
});

async function deletePrefix(bucket: R2Bucket, prefix: string) {
  let cursor: string | undefined;
  do {
    const list = await bucket.list({ prefix, cursor, limit: 1000 });
    if (list.objects.length) await bucket.delete(list.objects.map((o) => o.key));
    cursor = list.truncated ? list.cursor : undefined;
  } while (cursor);
}

/** Everything the canvas needs in one request, with privacy redaction applied. */
treeRoutes.get('/trees/:treeId/graph', async (c) => {
  const db = c.get('db');
  const { tree, access } = await requireTree(db, c.req.param('treeId'), c.get('userId'), 'view');
  const [personRows, links, partnerRows, photos] = await db.batch([
    db.select().from(persons).where(eq(persons.treeId, tree.id)),
    db.select().from(parentChild).where(eq(parentChild.treeId, tree.id)),
    db.select().from(partnerships).where(eq(partnerships.treeId, tree.id)),
    db
      .select({ id: media.id, r2Key: media.r2Key, thumbKey: media.thumbKey })
      .from(media)
      .where(
        and(
          eq(media.treeId, tree.id),
          eq(media.status, 'ready'),
          sql`${media.id} in (select ${persons.profileMediaId} from ${persons} where ${persons.treeId} = ${tree.id})`,
        ),
      ),
  ]);
  const storage = createStorage(c.env);
  const photoUrls = new Map<string, string>();
  await Promise.all(photos.map(async (m) => photoUrls.set(m.id, await storage.getUrl(m.thumbKey ?? m.r2Key))));
  const graph: TreeGraph = {
    persons: personRows.map((p) => redactSummary(toPersonSummary(p, p.profileMediaId ? (photoUrls.get(p.profileMediaId) ?? null) : null), access)),
    parentChild: links.map((l) => ({ id: l.id, parentId: l.parentId, childId: l.childId, type: l.type })),
    partnerships: partnerRows.map(toPartnershipDto),
  };
  return c.json(graph);
});

// ── Members ──────────────────────────────────────────────────────────

treeRoutes.get('/trees/:treeId/members', requireAuth, async (c) => {
  const db = c.get('db');
  const { tree, access } = await requireTree(db, c.req.param('treeId'), uid(c), 'view');
  if (access.restricted) throw forbidden('Members only');
  const rows = await db
    .select({ m: treeMembers, u: users })
    .from(treeMembers)
    .innerJoin(users, eq(users.id, treeMembers.userId))
    .where(eq(treeMembers.treeId, tree.id))
    .orderBy(treeMembers.joinedAt);
  const out: MemberDto[] = rows.map(({ m, u }) => ({
    userId: m.userId,
    role: m.role,
    personId: m.personId,
    displayName: u.displayName,
    // only admins see members' email addresses
    email: access.canManage ? u.email : null,
    imageUrl: u.imageUrl,
    joinedAt: m.joinedAt,
  }));
  return c.json(out);
});

async function adminCount(db: AppEnv['Variables']['db'], treeId: string) {
  const [{ n }] = await db.select({ n: count() }).from(treeMembers).where(and(eq(treeMembers.treeId, treeId), eq(treeMembers.role, 'admin')));
  return n;
}

treeRoutes.patch('/trees/:treeId/members/:userId', requireAuth, v('json', updateMemberSchema), async (c) => {
  const db = c.get('db');
  const { tree } = await requireTree(db, c.req.param('treeId'), uid(c), 'manage');
  const target = await db.query.treeMembers.findFirst({ where: and(eq(treeMembers.treeId, tree.id), eq(treeMembers.userId, c.req.param('userId'))) });
  if (!target) throw notFound('Member');
  const { role } = c.req.valid('json');
  if (target.role === 'admin' && role !== 'admin' && (await adminCount(db, tree.id)) <= 1) throw conflict('A tree needs at least one admin');
  await db.batch([
    db.update(treeMembers).set({ role }).where(and(eq(treeMembers.treeId, tree.id), eq(treeMembers.userId, target.userId))),
    auditQuery(db, { treeId: tree.id, userId: uid(c), entityType: 'member', entityId: target.userId, action: 'update', before: { role: target.role }, after: { role } }),
  ]);
  return c.json({ ok: true });
});

/** Admins remove members; any member may remove themselves (leave). */
treeRoutes.delete('/trees/:treeId/members/:userId', requireAuth, async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const targetId = c.req.param('userId');
  const { tree, access } = await requireTree(db, c.req.param('treeId'), me, 'view');
  if (targetId !== me && !access.canManage) throw forbidden();
  const target = await db.query.treeMembers.findFirst({ where: and(eq(treeMembers.treeId, tree.id), eq(treeMembers.userId, targetId)) });
  if (!target) throw notFound('Member');
  if (target.role === 'admin' && (await adminCount(db, tree.id)) <= 1) throw conflict('A tree needs at least one admin');
  await db.batch([
    db.delete(treeMembers).where(and(eq(treeMembers.treeId, tree.id), eq(treeMembers.userId, targetId))),
    db.update(persons).set({ userId: null }).where(and(eq(persons.treeId, tree.id), eq(persons.userId, targetId))),
    auditQuery(db, { treeId: tree.id, userId: me, entityType: 'member', entityId: targetId, action: 'delete', before: { role: target.role } }),
  ]);
  return c.body(null, 204);
});

// ── Friend (observer) access ─────────────────────────────────────────

treeRoutes.post('/trees/:treeId/friend-requests', requireAuth, async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree, access } = await loadTreeAccess(db, c.req.param('treeId'), me);
  if (access.role) throw conflict('Already a member');
  if (tree.privacy !== 'friends') throw badRequest('This tree does not accept friend requests');
  await db
    .insert(friendAccess)
    .values({ treeId: tree.id, userId: me, status: 'pending' })
    .onConflictDoUpdate({
      target: [friendAccess.treeId, friendAccess.userId],
      set: { status: sql`case when ${friendAccess.status} = 'approved' then 'approved' else 'pending' end`, requestedAt: Date.now() },
    });
  return c.json({ ok: true }, 201);
});

treeRoutes.get('/trees/:treeId/friend-requests', requireAuth, async (c) => {
  const db = c.get('db');
  const { tree } = await requireTree(db, c.req.param('treeId'), uid(c), 'manage');
  const rows = await db
    .select({ f: friendAccess, u: users })
    .from(friendAccess)
    .innerJoin(users, eq(users.id, friendAccess.userId))
    .where(eq(friendAccess.treeId, tree.id))
    .orderBy(desc(friendAccess.requestedAt));
  const out: FriendRequestDto[] = rows.map(({ f, u }) => ({
    userId: f.userId,
    status: f.status,
    displayName: u.displayName,
    email: u.email,
    requestedAt: f.requestedAt,
  }));
  return c.json(out);
});

treeRoutes.patch('/trees/:treeId/friend-requests/:userId', requireAuth, v('json', decideFriendSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'manage');
  const { status } = c.req.valid('json');
  const res = await db
    .update(friendAccess)
    .set({ status, decidedBy: me, decidedAt: Date.now() })
    .where(and(eq(friendAccess.treeId, tree.id), eq(friendAccess.userId, c.req.param('userId'))))
    .returning();
  if (!res.length) throw notFound('Friend request');
  await auditQuery(db, { treeId: tree.id, userId: me, entityType: 'friend', entityId: c.req.param('userId'), action: 'update', after: { status } });
  return c.json({ ok: true });
});

treeRoutes.delete('/trees/:treeId/friend-requests/:userId', requireAuth, async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const target = c.req.param('userId');
  const { tree, access } = await loadTreeAccess(db, c.req.param('treeId'), me);
  if (target !== me && !access.canManage) throw forbidden();
  await db.delete(friendAccess).where(and(eq(friendAccess.treeId, tree.id), eq(friendAccess.userId, target)));
  return c.body(null, 204);
});

// ── Edit history ─────────────────────────────────────────────────────

treeRoutes.get('/trees/:treeId/audit', requireAuth, v('query', paginationQuerySchema), async (c) => {
  const db = c.get('db');
  const { tree, access } = await requireTree(db, c.req.param('treeId'), uid(c), 'view');
  if (access.restricted) throw forbidden('Members only');
  const { cursor, limit } = c.req.valid('query');
  const entityId = c.req.query('entityId');
  const [curAt, curId] = cursor?.split(':') ?? [];
  const rows = await db
    .select({ a: auditLog, name: users.displayName })
    .from(auditLog)
    .leftJoin(users, eq(users.id, auditLog.userId))
    .where(
      and(
        eq(auditLog.treeId, tree.id),
        entityId ? eq(auditLog.entityId, entityId) : undefined,
        cursor ? or(lt(auditLog.createdAt, Number(curAt)), and(eq(auditLog.createdAt, Number(curAt)), lt(auditLog.id, curId))) : undefined,
      ),
    )
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .limit(limit + 1);
  const items: AuditEntryDto[] = rows.slice(0, limit).map(({ a, name }) => ({
    id: a.id,
    userId: a.userId,
    userName: name,
    entityType: a.entityType,
    entityId: a.entityId,
    action: a.action,
    // contact details never leave the server through the history view
    changes: a.changes ? Object.fromEntries(Object.entries(a.changes).filter(([k]) => k !== 'contacts')) : null,
    summary: a.summary,
    createdAt: a.createdAt,
  }));
  const last = items[items.length - 1];
  return c.json({ items, nextCursor: rows.length > limit && last ? `${last.createdAt}:${last.id}` : null });
});

function pick<T extends object>(row: T, keysFrom: object): Partial<T> {
  return Object.fromEntries(Object.keys(keysFrom).map((k) => [k, (row as Record<string, unknown>)[k]])) as Partial<T>;
}

