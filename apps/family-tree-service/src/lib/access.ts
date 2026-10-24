import type { FriendStatus, TreePrivacy, TreeRole, ViewerAccess } from '@super-project/types';

export interface AccessInput {
  privacy: TreePrivacy;
  role: TreeRole | null;
  friendStatus: FriendStatus | null;
  personId: string | null;
}

/**
 * The single place that decides what a viewer may do in a tree.
 * - members (any role) see everything except other people's private contacts
 * - approved friends may view `friends` trees read-only
 * - anyone may view `public` trees read-only
 * - non-members never see sensitive details of living persons (`restricted`)
 */
export function computeAccess({ privacy, role, friendStatus, personId }: AccessInput): ViewerAccess {
  const isFriend = friendStatus === 'approved';
  const isMember = role !== null;
  const canView = isMember || privacy === 'public' || (privacy === 'friends' && isFriend);
  return {
    role,
    isFriend,
    friendStatus,
    personId: isMember ? personId : null,
    canView,
    canEdit: role === 'admin' || role === 'editor',
    canManage: role === 'admin',
    restricted: !isMember,
  };
}

export type Need = 'view' | 'edit' | 'manage';

export function allows(access: ViewerAccess, need: Need): boolean {
  if (need === 'manage') return access.canManage;
  if (need === 'edit') return access.canEdit;
  return access.canView;
}
