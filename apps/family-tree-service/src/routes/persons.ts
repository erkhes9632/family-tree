import { Hono } from 'hono';
import { and, asc, count, eq, like, or } from 'drizzle-orm';
import { FamilyIndex } from '@super-project/genealogy';
import {
  addRelativeSchema,
  customFieldsSchema,
  personInputSchema,
  personUpdateSchema,
  type PersonInput,
  type TreeGraph,
} from '@super-project/types';
import type { AppEnv } from '../env';
import type { Database } from '../db';
import { media, parentChild, partnerships, personCustomFields, persons, treeMembers, trees } from '../db/schema';
import { requireAuth, uid } from '../middleware/auth';
import { auditQuery } from '../lib/audit';
import { badRequest, conflict, forbidden, ApiError } from '../lib/errors';
import { newId } from '../lib/ids';
import { personValues, toPartnershipDto, toPersonDto, toPersonSummary } from '../lib/mappers';
import { redactPerson, redactSummary } from '../lib/privacy';
import { createStorage } from '../lib/storage';
import { requirePerson, requireTree } from '../lib/tree-access';
import { v } from '../lib/validate';

export const personRoutes = new Hono<AppEnv>();

/** Load the tree's relationship graph (ids only matter here) for integrity checks. */
export async function loadIndex(db: Database, treeId: string): Promise<FamilyIndex> {
  const [ps, links, pts] = await db.batch([
    db.select().from(persons).where(eq(persons.treeId, treeId)),
    db.select().from(parentChild).where(eq(parentChild.treeId, treeId)),
    db.select().from(partnerships).where(eq(partnerships.treeId, treeId)),
  ]);
  const graph: TreeGraph = {
    persons: ps.map((p) => toPersonSummary(p)),
    parentChild: links.map((l) => ({ id: l.id, parentId: l.parentId, childId: l.childId, type: l.type })),
    partnerships: pts.map(toPartnershipDto),
  };
  return new FamilyIndex(graph);
}

async function checkProfileMedia(db: Database, treeId: string, mediaId: string | null | undefined) {
  if (!mediaId) return;
  const m = await db.query.media.findFirst({ where: and(eq(media.id, mediaId), eq(media.treeId, treeId)) });
  if (!m || m.kind !== 'photo') throw badRequest('profileMediaId must be a photo in this tree');
}

personRoutes.post('/trees/:treeId/persons', requireAuth, v('json', personInputSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const input = c.req.valid('json');
  await checkProfileMedia(db, tree.id, input.profileMediaId);
  const id = newId();
  const [[row]] = await db.batch([
    db.insert(persons).values({ ...personValues(input), givenName: input.givenName, id, treeId: tree.id, createdBy: me }).returning(),
    auditQuery(db, { treeId: tree.id, userId: me, entityType: 'person', entityId: id, action: 'create', after: input, summary: input.givenName }),
    db.update(trees).set({ updatedAt: Date.now(), rootPersonId: tree.rootPersonId ?? id }).where(eq(trees.id, tree.id)),
  ]);
  return c.json(toPersonSummary(row), 201);
});

personRoutes.get('/trees/:treeId/persons/:personId', async (c) => {
  const db = c.get('db');
  const viewer = c.get('userId');
  const { tree, access } = await requireTree(db, c.req.param('treeId'), viewer, 'view');
  const p = await requirePerson(db, tree.id, c.req.param('personId'));
  const fields = await db
    .select()
    .from(personCustomFields)
    .where(eq(personCustomFields.personId, p.id))
    .orderBy(asc(personCustomFields.sortOrder));
  let photoUrl: string | null = null;
  if (p.profileMediaId) {
    const m = await db.query.media.findFirst({ where: and(eq(media.id, p.profileMediaId), eq(media.status, 'ready')) });
    if (m) photoUrl = await createStorage(c.env).getUrl(m.thumbKey ?? m.r2Key);
  }
  const dto = toPersonDto(p, {
    photoUrl,
    customFields: fields.map((f) => ({ id: f.id, key: f.key, value: f.value, sortOrder: f.sortOrder })),
  });
  return c.json(redactPerson(dto, access, viewer));
});

/** Editors, admins, and the person themselves (linked account) may edit a profile. */
async function requireEditablePerson(db: Database, treeId: string, personId: string, userId: string) {
  const ctx = await requireTree(db, treeId, userId, 'view');
  const person = await requirePerson(db, treeId, personId);
  const isSelf = person.userId === userId;
  if (!ctx.access.canEdit && !(isSelf && !ctx.access.restricted)) throw forbidden();
  return { ...ctx, person };
}

personRoutes.patch('/trees/:treeId/persons/:personId', requireAuth, v('json', personUpdateSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree, person } = await requireEditablePerson(db, c.req.param('treeId'), c.req.param('personId'), me);
  const body = c.req.valid('json');
  await checkProfileMedia(db, tree.id, body.profileMediaId);
  const values = personValues(body);
  const before = Object.fromEntries(Object.keys(values).map((k) => [k, (person as Record<string, unknown>)[k]]));
  const [[row]] = await db.batch([
    db.update(persons).set(values).where(eq(persons.id, person.id)).returning(),
    auditQuery(db, { treeId: tree.id, userId: me, entityType: 'person', entityId: person.id, action: 'update', before, after: values, summary: person.givenName }),
    db.update(trees).set({ updatedAt: Date.now() }).where(eq(trees.id, tree.id)),
  ]);
  return c.json(toPersonSummary(row));
});

personRoutes.delete('/trees/:treeId/persons/:personId', requireAuth, async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const person = await requirePerson(db, tree.id, c.req.param('personId'));
  const { id: _id, createdAt: _c, updatedAt: _u, ...snapshot } = person;
  await db.batch([
    db.delete(persons).where(eq(persons.id, person.id)),
    db.update(treeMembers).set({ personId: null }).where(and(eq(treeMembers.treeId, tree.id), eq(treeMembers.personId, person.id))),
    db.update(trees).set({ rootPersonId: tree.rootPersonId === person.id ? null : tree.rootPersonId, updatedAt: Date.now() }).where(eq(trees.id, tree.id)),
    auditQuery(db, { treeId: tree.id, userId: me, entityType: 'person', entityId: person.id, action: 'delete', before: snapshot, summary: person.givenName }),
  ]);
  return c.body(null, 204);
});

personRoutes.put('/trees/:treeId/persons/:personId/custom-fields', requireAuth, v('json', customFieldsSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree, person } = await requireEditablePerson(db, c.req.param('treeId'), c.req.param('personId'), me);
  const { fields } = c.req.valid('json');
  const before = await db.select().from(personCustomFields).where(eq(personCustomFields.personId, person.id));
  // one insert per row keeps each statement well under D1's 100-bound-parameter limit
  await db.batch([
    db.delete(personCustomFields).where(eq(personCustomFields.personId, person.id)),
    ...fields.map((f, i) => db.insert(personCustomFields).values({ treeId: tree.id, personId: person.id, key: f.key, value: f.value, sortOrder: i })),
    auditQuery(db, {
      treeId: tree.id,
      userId: me,
      entityType: 'person',
      entityId: person.id,
      action: 'update',
      before: { customFields: before.map((f) => `${f.key}: ${f.value}`) },
      after: { customFields: fields.map((f) => `${f.key}: ${f.value}`) },
      summary: person.givenName,
    }),
  ]);
  return c.json({ ok: true });
});

/** Add father / mother / partner / child / sibling to an anchor person in one atomic request. */
personRoutes.post('/trees/:treeId/persons/:personId/relatives', requireAuth, v('json', addRelativeSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'edit');
  const anchor = await requirePerson(db, tree.id, c.req.param('personId'));
  const body = c.req.valid('json');
  const idx = await loadIndex(db, tree.id);

  let relId: string;
  let newPerson: PersonInput | null = null;
  if (body.existingPersonId) {
    if (!idx.get(body.existingPersonId)) throw badRequest('existingPersonId is not in this tree');
    if (body.existingPersonId === anchor.id) throw badRequest('Cannot relate a person to themselves');
    relId = body.existingPersonId;
  } else {
    relId = newId();
    newPerson = { ...(body.person as PersonInput) };
    if (body.relation === 'father') newPerson.gender = 'male';
    if (body.relation === 'mother') newPerson.gender = 'female';
  }

  const links: { parentId: string; childId: string; type: typeof body.linkType }[] = [];
  const unions: { a: string; b: string; status: typeof body.partnershipStatus; order: number }[] = [];
  const hasPartnership = (a: string, b: string) => !!idx.partnershipBetween(a, b);

  switch (body.relation) {
    case 'father':
    case 'mother': {
      const want = body.relation === 'father' ? 'male' : 'female';
      if (body.linkType === 'biological') {
        const clash = idx.parents(anchor.id).find((p) => p.type === 'biological' && idx.get(p.id)?.gender === want);
        if (clash) throw conflict(`This person already has a biological ${body.relation}`);
      }
      links.push({ parentId: relId, childId: anchor.id, type: body.linkType });
      // pair the new parent with the existing other parent so their child sits under one union
      const other = idx.parents(anchor.id).find((p) => p.type === body.linkType && idx.get(p.id)?.gender !== want);
      if (other && !hasPartnership(other.id, relId)) {
        unions.push({ a: other.id, b: relId, status: body.partnershipStatus, order: idx.partnerships(other.id).length });
      }
      break;
    }
    case 'partner':
      if (hasPartnership(anchor.id, relId) && body.existingPersonId) throw conflict('These two are already partners');
      unions.push({ a: anchor.id, b: relId, status: body.partnershipStatus, order: idx.partnerships(anchor.id).length });
      break;
    case 'child': {
      links.push({ parentId: anchor.id, childId: relId, type: body.linkType });
      if (body.otherParentId) {
        if (!idx.partners(anchor.id).includes(body.otherParentId)) throw badRequest('otherParentId must be a partner of this person');
        links.push({ parentId: body.otherParentId, childId: relId, type: body.linkType });
      }
      break;
    }
    case 'sibling': {
      const parents = idx.parents(anchor.id).filter((p) => p.type === 'biological' || p.type === 'adoptive' || p.type === 'unknown');
      if (!parents.length) throw new ApiError(400, 'needs_parent', 'Add a parent first, then add siblings as their children');
      for (const p of parents) links.push({ parentId: p.id, childId: relId, type: body.linkType });
      break;
    }
  }

  for (const l of links) {
    if (idx.parents(l.childId).some((p) => p.id === l.parentId)) throw conflict('That parent–child link already exists');
    if (body.existingPersonId && idx.wouldCreateCycle(l.parentId, l.childId)) throw conflict('That link would make someone their own ancestor');
  }

  const stmts = [];
  if (newPerson) {
    stmts.push(db.insert(persons).values({ ...personValues(newPerson), givenName: newPerson.givenName, id: relId, treeId: tree.id, createdBy: me }));
    stmts.push(auditQuery(db, { treeId: tree.id, userId: me, entityType: 'person', entityId: relId, action: 'create', after: newPerson, summary: `${newPerson.givenName} (${body.relation} of ${anchor.givenName})` }));
  }
  const linkIds: string[] = [];
  for (const l of links) {
    const id = newId();
    linkIds.push(id);
    stmts.push(db.insert(parentChild).values({ id, treeId: tree.id, ...l }));
    stmts.push(auditQuery(db, { treeId: tree.id, userId: me, entityType: 'parent_child', entityId: id, action: 'create', after: l }));
  }
  const unionIds: string[] = [];
  for (const u of unions) {
    const id = newId();
    unionIds.push(id);
    stmts.push(db.insert(partnerships).values({ id, treeId: tree.id, person1Id: u.a, person2Id: u.b, status: u.status, sortOrder: u.order }));
    stmts.push(auditQuery(db, { treeId: tree.id, userId: me, entityType: 'partnership', entityId: id, action: 'create', after: { person1Id: u.a, person2Id: u.b, status: u.status } }));
  }
  stmts.push(db.update(trees).set({ updatedAt: Date.now() }).where(eq(trees.id, tree.id)));
  await db.batch(stmts as [typeof stmts[number], ...typeof stmts]);
  return c.json({ personId: relId, parentChildIds: linkIds, partnershipIds: unionIds }, 201);
});

/** "This is me": a member links their account to a person node. */
personRoutes.post('/trees/:treeId/persons/:personId/claim', requireAuth, async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree, access } = await requireTree(db, c.req.param('treeId'), me, 'view');
  if (!access.role) throw forbidden('Join the tree first (use an invitation)');
  const person = await requirePerson(db, tree.id, c.req.param('personId'));
  if (person.userId && person.userId !== me) throw conflict('That person is already linked to another account');
  await db.batch([
    db.update(persons).set({ userId: null }).where(and(eq(persons.treeId, tree.id), eq(persons.userId, me))),
    db.update(persons).set({ userId: me }).where(eq(persons.id, person.id)),
    db.update(treeMembers).set({ personId: person.id }).where(and(eq(treeMembers.treeId, tree.id), eq(treeMembers.userId, me))),
    auditQuery(db, { treeId: tree.id, userId: me, entityType: 'person', entityId: person.id, action: 'update', before: { userId: person.userId }, after: { userId: me }, summary: 'claimed profile' }),
  ]);
  return c.json({ ok: true });
});

/** Unlink an account from a person (the person themselves or an admin). */
personRoutes.delete('/trees/:treeId/persons/:personId/claim', requireAuth, async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree, access } = await requireTree(db, c.req.param('treeId'), me, 'view');
  const person = await requirePerson(db, tree.id, c.req.param('personId'));
  if (!person.userId) return c.body(null, 204);
  if (person.userId !== me && !access.canManage) throw forbidden();
  await db.batch([
    db.update(persons).set({ userId: null }).where(eq(persons.id, person.id)),
    db.update(treeMembers).set({ personId: null }).where(and(eq(treeMembers.treeId, tree.id), eq(treeMembers.personId, person.id))),
    auditQuery(db, { treeId: tree.id, userId: me, entityType: 'person', entityId: person.id, action: 'update', before: { userId: person.userId }, after: { userId: null }, summary: 'unlinked account' }),
  ]);
  return c.body(null, 204);
});

/** Lightweight name search (server-side, for very large trees and pickers). */
personRoutes.get('/trees/:treeId/persons', async (c) => {
  const db = c.get('db');
  const { tree, access } = await requireTree(db, c.req.param('treeId'), c.get('userId'), 'view');
  const q = (c.req.query('q') ?? '').trim();
  const pattern = `%${q.replace(/[%_]/g, '')}%`;
  const rows = await db
    .select()
    .from(persons)
    .where(and(eq(persons.treeId, tree.id), q ? or(like(persons.givenName, pattern), like(persons.patronymic, pattern), like(persons.clanName, pattern)) : undefined))
    .orderBy(asc(persons.givenName))
    .limit(50);
  const [{ n }] = await db.select({ n: count() }).from(persons).where(eq(persons.treeId, tree.id));
  return c.json({ total: n, items: rows.map((p) => redactSummary(toPersonSummary(p), access)) });
});
