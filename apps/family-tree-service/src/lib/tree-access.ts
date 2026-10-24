import { and, eq } from 'drizzle-orm';
import type { ViewerAccess } from '@super-project/types';
import type { Database } from '../db';
import { friendAccess, persons, treeMembers, trees, type PersonRow, type TreeRow } from '../db/schema';
import { allows, computeAccess, type Need } from './access';
import { ApiError, forbidden, notFound, unauthorized } from './errors';

export interface TreeContext {
  tree: TreeRow;
  access: ViewerAccess;
}

export async function loadTreeAccess(db: Database, treeId: string, userId: string | null): Promise<TreeContext> {
  const [treeRows, memberRows, friendRows] = await db.batch([
    db.select().from(trees).where(eq(trees.id, treeId)).limit(1),
    db
      .select({ role: treeMembers.role, personId: treeMembers.personId })
      .from(treeMembers)
      .where(and(eq(treeMembers.treeId, treeId), eq(treeMembers.userId, userId ?? '')))
      .limit(1),
    db
      .select({ status: friendAccess.status })
      .from(friendAccess)
      .where(and(eq(friendAccess.treeId, treeId), eq(friendAccess.userId, userId ?? '')))
      .limit(1),
  ]);
  const tree = treeRows[0];
  if (!tree) throw notFound('Tree');
  const member = memberRows[0];
  const access = computeAccess({
    privacy: tree.privacy,
    role: member?.role ?? null,
    friendStatus: friendRows[0]?.status ?? null,
    personId: member?.personId ?? null,
  });
  return { tree, access };
}

/** Load a tree and enforce the required permission. */
export async function requireTree(db: Database, treeId: string, userId: string | null, need: Need): Promise<TreeContext> {
  const ctx = await loadTreeAccess(db, treeId, userId);
  if (!ctx.access.canView) {
    if (!userId) throw unauthorized();
    // friends trees reveal their name so the UI can offer "request access"
    throw new ApiError(403, 'no_access', 'You do not have access to this tree', {
      privacy: ctx.tree.privacy,
      name: ctx.tree.privacy === 'friends' ? ctx.tree.name : undefined,
      friendStatus: ctx.access.friendStatus,
    });
  }
  if (!allows(ctx.access, need)) throw forbidden();
  return ctx;
}

export async function requirePerson(db: Database, treeId: string, personId: string): Promise<PersonRow> {
  const p = await db.query.persons.findFirst({ where: and(eq(persons.id, personId), eq(persons.treeId, treeId)) });
  if (!p) throw notFound('Person');
  return p;
}
