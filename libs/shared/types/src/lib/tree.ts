import { z } from 'zod';
import { personInputSchema } from './person';
import { TREE_PRIVACY, TREE_ROLES, FRIEND_STATUSES, type TreePrivacy, type TreeRole, type FriendStatus } from './enums';

export const createTreeSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  privacy: z.enum(TREE_PRIVACY).default('family'),
  clanId: z.string().nullable().optional(),
  /** optionally start the tree with the creator's own person node, linked to their account */
  self: personInputSchema.optional(),
});
export type CreateTreeInput = z.infer<typeof createTreeSchema>;

export const updateTreeSchema = createTreeSchema.omit({ self: true }).partial().extend({
  rootPersonId: z.string().nullable().optional(),
  coverMediaId: z.string().nullable().optional(),
});
export type UpdateTreeInput = z.infer<typeof updateTreeSchema>;

export interface TreeDto {
  id: string;
  name: string;
  description: string | null;
  privacy: TreePrivacy;
  ownerId: string;
  rootPersonId: string | null;
  clanId: string | null;
  coverMediaId: string | null;
  personCount?: number;
  createdAt: number;
  updatedAt: number;
}

/** What the current viewer may do in a tree; computed by the API. */
export interface ViewerAccess {
  role: TreeRole | null;
  isFriend: boolean;
  friendStatus: FriendStatus | null;
  personId: string | null;
  canView: boolean;
  canEdit: boolean;
  canManage: boolean;
  /** true when living-person details are hidden from this viewer */
  restricted: boolean;
}

export interface TreeWithAccess extends TreeDto {
  access: ViewerAccess;
}

export const updateMemberSchema = z.object({ role: z.enum(TREE_ROLES) });

export interface MemberDto {
  userId: string;
  role: TreeRole;
  personId: string | null;
  displayName: string | null;
  email: string | null;
  imageUrl: string | null;
  joinedAt: number;
}

export const decideFriendSchema = z.object({ status: z.enum(['approved', 'rejected']) });

export interface FriendRequestDto {
  userId: string;
  status: FriendStatus;
  displayName: string | null;
  email: string | null;
  requestedAt: number;
}
