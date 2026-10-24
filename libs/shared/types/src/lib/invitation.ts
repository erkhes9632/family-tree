import { z } from 'zod';
import { TREE_ROLES, type TreeRole } from './enums';

export const createInvitationSchema = z.object({
  kind: z.enum(['email', 'link']),
  email: z.email().optional(),
  role: z.enum(TREE_ROLES).default('viewer'),
  personId: z.string().nullable().optional(),
  /** days until expiry */
  expiresInDays: z.number().int().min(1).max(90).default(14),
  maxUses: z.number().int().min(1).max(500).nullable().optional(),
  message: z.string().max(1000).optional(),
}).refine((v) => v.kind !== 'email' || !!v.email, { message: 'email required', path: ['email'] });
export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;

export interface InvitationDto {
  id: string;
  treeId: string;
  kind: 'email' | 'link';
  email: string | null;
  role: TreeRole;
  personId: string | null;
  token: string;
  expiresAt: number;
  maxUses: number | null;
  useCount: number;
  revokedAt: number | null;
  createdAt: number;
}

export interface InvitationPreview {
  treeId: string;
  treeName: string;
  role: TreeRole;
  inviterName: string | null;
  personId: string | null;
  personName: string | null;
  valid: boolean;
  reason?: 'expired' | 'revoked' | 'used' | 'not_found';
}

export const acceptInvitationSchema = z.object({
  /** "this is me" — link the account to an existing person node */
  personId: z.string().nullable().optional(),
});
