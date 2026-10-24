import { Hono } from 'hono';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import {
  acceptInvitationSchema,
  createInvitationSchema,
  type InvitationDto,
  type InvitationPreview,
  type TreeRole,
} from '@super-project/types';
import type { AppEnv } from '../env';
import { invitations, persons, treeMembers, trees, users, type PersonRow } from '../db/schema';
import { requireAuth, uid } from '../middleware/auth';
import { rateLimit } from '../middleware/rate-limit';
import { auditQuery } from '../lib/audit';
import { emailLayout, escapeHtml, sendEmail } from '../lib/email';
import { badRequest, conflict, notFound } from '../lib/errors';
import { newToken } from '../lib/ids';
import { requireTree } from '../lib/tree-access';
import { v } from '../lib/validate';

export const invitationRoutes = new Hono<AppEnv>();

const ROLE_RANK: Record<TreeRole, number> = { viewer: 0, editor: 1, admin: 2 };

function toDto(i: typeof invitations.$inferSelect): InvitationDto {
  return {
    id: i.id,
    treeId: i.treeId,
    kind: i.kind,
    email: i.email,
    role: i.role,
    personId: i.personId,
    token: i.token,
    expiresAt: i.expiresAt,
    maxUses: i.maxUses,
    useCount: i.useCount,
    revokedAt: i.revokedAt,
    createdAt: i.createdAt,
  };
}

export function invitationState(i: Pick<typeof invitations.$inferSelect, 'revokedAt' | 'expiresAt' | 'maxUses' | 'useCount'>, now = Date.now()) {
  if (i.revokedAt) return 'revoked' as const;
  if (i.expiresAt < now) return 'expired' as const;
  if (i.maxUses != null && i.useCount >= i.maxUses) return 'used' as const;
  return 'valid' as const;
}

invitationRoutes.get('/trees/:treeId/invitations', requireAuth, async (c) => {
  const db = c.get('db');
  const { tree } = await requireTree(db, c.req.param('treeId'), uid(c), 'manage');
  const rows = await db.select().from(invitations).where(eq(invitations.treeId, tree.id)).orderBy(desc(invitations.createdAt));
  return c.json(rows.map(toDto));
});

invitationRoutes.post('/trees/:treeId/invitations', requireAuth, rateLimit('INVITE_LIMITER'), v('json', createInvitationSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const { tree } = await requireTree(db, c.req.param('treeId'), me, 'manage');
  const body = c.req.valid('json');
  let person: PersonRow | undefined;
  if (body.personId) {
    person = await db.query.persons.findFirst({ where: and(eq(persons.id, body.personId), eq(persons.treeId, tree.id)) });
    if (!person) throw badRequest('personId is not in this tree');
    if (person.userId) throw conflict('That person is already linked to an account');
  }
  const [row] = await db
    .insert(invitations)
    .values({
      treeId: tree.id,
      kind: body.kind,
      token: newToken(),
      email: body.kind === 'email' ? (body.email ?? null) : null,
      role: body.role,
      personId: body.personId ?? null,
      message: body.message ?? null,
      createdBy: me,
      expiresAt: Date.now() + body.expiresInDays * 86_400_000,
      // email invitations are single use
      maxUses: body.kind === 'email' ? 1 : (body.maxUses ?? null),
    })
    .returning();
  await auditQuery(db, { treeId: tree.id, userId: me, entityType: 'invitation', entityId: row.id, action: 'create', after: { kind: row.kind, role: row.role, email: row.email } });

  const url = `${c.env.WEB_ORIGIN.split(',')[0]}/invite/${row.token}`;
  if (row.kind === 'email' && row.email) {
    const inviter = await db.query.users.findFirst({ where: eq(users.id, me) });
    const who = escapeHtml(inviter?.displayName ?? inviter?.email ?? 'Таны төрөл');
    const note = body.message ? `<blockquote style="margin:12px 0;padding-left:12px;border-left:3px solid #e5d3b3">${escapeHtml(body.message)}</blockquote>` : '';
    const html = emailLayout(
      `«${tree.name}» ургийн бичигт урилга`,
      `<p>${who} таныг «${escapeHtml(tree.name)}» гэр бүлийн ургийн бичигт урьж байна.</p>${note}
       <p style="color:#6b7280;font-size:13px">${who} invited you to join the “${escapeHtml(tree.name)}” family tree.${person ? ` You were added as ${escapeHtml(person.givenName)}.` : ''}</p>`,
      { href: url, label: 'Урилгыг хүлээн авах · Accept invitation' },
    );
    c.executionCtx.waitUntil(
      sendEmail(c.env, {
        to: row.email,
        subject: `Урилга: ${tree.name} ургийн бичиг`,
        html,
        text: `${inviter?.displayName ?? 'A relative'} invited you to the "${tree.name}" family tree: ${url}`,
      }),
    );
  }
  return c.json({ ...toDto(row), url }, 201);
});

invitationRoutes.delete('/trees/:treeId/invitations/:id', requireAuth, async (c) => {
  const db = c.get('db');
  const { tree } = await requireTree(db, c.req.param('treeId'), uid(c), 'manage');
  const res = await db
    .update(invitations)
    .set({ revokedAt: Date.now() })
    .where(and(eq(invitations.id, c.req.param('id')), eq(invitations.treeId, tree.id), isNull(invitations.revokedAt)))
    .returning();
  if (!res.length) throw notFound('Invitation');
  return c.body(null, 204);
});

/** Public preview so the invite page can show what is being accepted. */
invitationRoutes.get('/invitations/:token', rateLimit('INVITE_LIMITER'), async (c) => {
  const db = c.get('db');
  const row = await db
    .select({ i: invitations, treeName: trees.name, inviter: users.displayName, personName: persons.givenName })
    .from(invitations)
    .innerJoin(trees, eq(trees.id, invitations.treeId))
    .leftJoin(users, eq(users.id, invitations.createdBy))
    .leftJoin(persons, eq(persons.id, invitations.personId))
    .where(eq(invitations.token, c.req.param('token')))
    .get();
  if (!row) {
    return c.json({ valid: false, reason: 'not_found', treeId: '', treeName: '', role: 'viewer', inviterName: null, personId: null, personName: null } satisfies InvitationPreview);
  }
  const state = invitationState(row.i);
  const preview: InvitationPreview = {
    treeId: row.i.treeId,
    treeName: row.treeName,
    role: row.i.role,
    inviterName: row.inviter,
    personId: row.i.personId,
    personName: row.personName,
    valid: state === 'valid',
    reason: state === 'valid' ? undefined : state,
  };
  return c.json(preview);
});

invitationRoutes.post('/invitations/:token/accept', requireAuth, rateLimit('INVITE_LIMITER'), v('json', acceptInvitationSchema), async (c) => {
  const db = c.get('db');
  const me = uid(c);
  const inv = await db.query.invitations.findFirst({ where: eq(invitations.token, c.req.param('token')) });
  if (!inv) throw notFound('Invitation');
  const state = invitationState(inv);
  if (state !== 'valid') throw conflict(`Invitation is ${state}`);

  const personId = c.req.valid('json').personId ?? inv.personId;
  if (personId) {
    const p = await db.query.persons.findFirst({ where: and(eq(persons.id, personId), eq(persons.treeId, inv.treeId)) });
    if (!p) throw badRequest('Person is not in this tree');
    if (p.userId && p.userId !== me) throw conflict('That person is already linked to another account');
  }

  const existing = await db.query.treeMembers.findFirst({ where: and(eq(treeMembers.treeId, inv.treeId), eq(treeMembers.userId, me)) });
  const role = existing && ROLE_RANK[existing.role] >= ROLE_RANK[inv.role] ? existing.role : inv.role;
  const linkPerson = personId ?? existing?.personId ?? null;

  // useCount is bumped with a guard so concurrent accepts can't exceed maxUses
  const bump = await db
    .update(invitations)
    .set({ useCount: sql`${invitations.useCount} + 1` })
    .where(and(eq(invitations.id, inv.id), sql`(${invitations.maxUses} is null or ${invitations.useCount} < ${invitations.maxUses})`))
    .returning({ id: invitations.id });
  if (!bump.length) throw conflict('Invitation is used');

  await db.batch([
    db
      .insert(treeMembers)
      .values({ treeId: inv.treeId, userId: me, role, personId: linkPerson, invitedBy: inv.createdBy })
      .onConflictDoUpdate({ target: [treeMembers.treeId, treeMembers.userId], set: { role, personId: linkPerson } }),
    ...(personId ? [db.update(persons).set({ userId: me }).where(eq(persons.id, personId))] : []),
    auditQuery(db, {
      treeId: inv.treeId,
      userId: me,
      entityType: 'member',
      entityId: me,
      action: existing ? 'update' : 'create',
      after: { role, personId: linkPerson },
      summary: 'accepted invitation',
    }),
  ]);
  return c.json({ treeId: inv.treeId, role, personId: linkPerson });
});
