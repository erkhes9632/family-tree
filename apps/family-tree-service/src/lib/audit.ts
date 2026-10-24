import type { Database } from '../db';
import { auditLog } from '../db/schema';
import { diff } from './mappers';

export interface AuditInput {
  treeId: string;
  userId: string | null;
  entityType: 'tree' | 'person' | 'parent_child' | 'partnership' | 'event' | 'media' | 'album' | 'story' | 'member' | 'invitation' | 'friend';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  before?: object | null;
  after?: object | null;
  summary?: string;
}

/** Build (not run) an audit insert so it can join a db.batch with the change itself. */
export function auditQuery(db: Database, a: AuditInput) {
  const changes = diff((a.before ?? null) as Record<string, unknown> | null, (a.after ?? null) as Record<string, unknown> | null);
  return db.insert(auditLog).values({
    treeId: a.treeId,
    userId: a.userId,
    entityType: a.entityType,
    entityId: a.entityId,
    action: a.action,
    changes: Object.keys(changes).length ? changes : null,
    summary: a.summary ?? null,
  });
}
