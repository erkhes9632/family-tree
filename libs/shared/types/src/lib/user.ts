import { z } from 'zod';
import { LOCALES, REMINDER_KINDS, type Locale, type TreeRole } from './enums';

export interface UserDto {
  id: string;
  email: string | null;
  displayName: string | null;
  imageUrl: string | null;
  locale: Locale;
  timezone: string;
}

export interface MeResponse {
  user: UserDto;
  memberships: { treeId: string; treeName: string; role: TreeRole; personId: string | null }[];
}

export const updateMeSchema = z.object({
  displayName: z.string().max(120).optional(),
  locale: z.enum(LOCALES).optional(),
  timezone: z.string().max(64).optional(),
});

export const notificationPrefsSchema = z.object({
  emailEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  daysBefore: z.number().int().min(0).max(30),
  kinds: z.array(z.enum(REMINDER_KINDS)),
  timezone: z.string().max(64),
});
export type NotificationPrefs = z.infer<typeof notificationPrefsSchema>;

export const pushSubscriptionSchema = z.object({
  endpoint: z.url(),
  expirationTime: z.number().nullable().optional(),
  keys: z.object({ p256dh: z.string(), auth: z.string() }),
});

export interface AuditEntryDto {
  id: string;
  userId: string | null;
  userName: string | null;
  entityType: string;
  entityId: string;
  action: 'create' | 'update' | 'delete';
  changes: Record<string, [unknown, unknown]> | null;
  summary: string | null;
  createdAt: number;
}

export interface ClanDto {
  id: string;
  slug: string;
  nameMn: string;
  nameEn: string;
}
