export const TREE_ROLES = ['admin', 'editor', 'viewer'] as const;
export type TreeRole = (typeof TREE_ROLES)[number];

export const TREE_PRIVACY = ['family', 'friends', 'public'] as const;
export type TreePrivacy = (typeof TREE_PRIVACY)[number];

export const GENDERS = ['male', 'female', 'other', 'unknown'] as const;
export type Gender = (typeof GENDERS)[number];

export const PARENT_LINK_TYPES = ['biological', 'adoptive', 'step', 'foster', 'unknown'] as const;
export type ParentLinkType = (typeof PARENT_LINK_TYPES)[number];

export const PARTNERSHIP_STATUSES = ['married', 'divorced', 'widowed', 'partner', 'unknown'] as const;
export type PartnershipStatus = (typeof PARTNERSHIP_STATUSES)[number];

export const DATE_QUALIFIERS = ['exact', 'about', 'before', 'after', 'estimated'] as const;
export type DateQualifier = (typeof DATE_QUALIFIERS)[number];

export const EVENT_TYPES = [
  'birth',
  'marriage',
  'divorce',
  'death',
  'graduation',
  'migration',
  'military',
  'award',
  'custom',
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const MEDIA_KINDS = ['photo', 'video', 'audio', 'document'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_CATEGORIES = [
  'portrait',
  'family',
  'event',
  'old_photo',
  'certificate',
  'medal',
  'letter',
  'genealogy_record',
  'story',
  'other',
] as const;
export type MediaCategory = (typeof MEDIA_CATEGORIES)[number];

export const FRIEND_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type FriendStatus = (typeof FRIEND_STATUSES)[number];

export const CONTACT_VISIBILITY = ['private', 'members'] as const;
export type ContactVisibility = (typeof CONTACT_VISIBILITY)[number];

export const RELATIVE_KINDS = ['father', 'mother', 'partner', 'child', 'sibling'] as const;
export type RelativeKind = (typeof RELATIVE_KINDS)[number];

export const REMINDER_KINDS = ['birthday', 'death_anniversary', 'wedding_anniversary'] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export const AUDIT_ACTIONS = ['create', 'update', 'delete'] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export const LOCALES = ['mn', 'en'] as const;
export type Locale = (typeof LOCALES)[number];

/** Upload limits per media kind, in bytes. Shared so web can validate before uploading. */
export const MEDIA_LIMITS: Record<MediaKind, { maxBytes: number; mime: readonly string[] }> = {
  photo: {
    maxBytes: 40 * 1024 * 1024,
    mime: ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/tiff'],
  },
  video: {
    maxBytes: 4 * 1024 * 1024 * 1024,
    mime: ['video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska'],
  },
  audio: {
    maxBytes: 300 * 1024 * 1024,
    mime: ['audio/webm', 'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/wav', 'audio/aac'],
  },
  document: {
    maxBytes: 200 * 1024 * 1024,
    mime: ['application/pdf', 'image/jpeg', 'image/png', 'image/tiff', 'image/webp'],
  },
};

/** Files above this size use multipart upload. */
export const MULTIPART_THRESHOLD = 90 * 1024 * 1024;
export const MULTIPART_PART_SIZE = 20 * 1024 * 1024;
