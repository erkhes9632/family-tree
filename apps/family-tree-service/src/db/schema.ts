import { sql } from 'drizzle-orm';
import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import {
  AUDIT_ACTIONS,
  CONTACT_VISIBILITY,
  DATE_QUALIFIERS,
  EVENT_TYPES,
  FRIEND_STATUSES,
  GENDERS,
  LOCALES,
  MEDIA_CATEGORIES,
  MEDIA_KINDS,
  PARENT_LINK_TYPES,
  PARTNERSHIP_STATUSES,
  REMINDER_KINDS,
  TREE_PRIVACY,
  TREE_ROLES,
  type Award,
  type Contacts,
  type Education,
  type Place,
  type ReminderKind,
  type Workplace,
} from '@super-project/types';
import { newId } from '../lib/ids';

/*
 * Conventions
 * - ids: short random text ids (see lib/ids.ts); users.id is the Clerk user id.
 * - timestamps: integer epoch milliseconds.
 * - partial dates: <name>_year / _month / _day / _qualifier columns, never a single DATE.
 * - flexible structured fields (places, education…) are JSON text columns.
 * - deleting a tree cascades to everything in it (D1 enforces foreign keys).
 */

const id = () => text().primaryKey().$defaultFn(() => newId());
const createdAt = () => integer().notNull().$defaultFn(() => Date.now());
const updatedAt = () => integer().notNull().$defaultFn(() => Date.now()).$onUpdateFn(() => Date.now());
const qualifier = () => text({ enum: DATE_QUALIFIERS });

export const users = sqliteTable(
  'users',
  {
    id: text().primaryKey(),
    email: text(),
    displayName: text(),
    imageUrl: text(),
    locale: text({ enum: LOCALES }).notNull().default('mn'),
    timezone: text().notNull().default('Asia/Ulaanbaatar'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: integer(),
  },
  (t) => [index('users_email_idx').on(t.email)],
);

export const clans = sqliteTable('clans', {
  id: text().primaryKey(),
  slug: text().notNull().unique(),
  nameMn: text().notNull(),
  nameEn: text().notNull(),
  summaryMn: text(),
  summaryEn: text(),
  createdAt: createdAt(),
});

export const trees = sqliteTable(
  'trees',
  {
    id: id(),
    name: text().notNull(),
    description: text(),
    privacy: text({ enum: TREE_PRIVACY }).notNull().default('family'),
    ownerId: text()
      .notNull()
      .references(() => users.id),
    /** default person to center the canvas on (no FK: avoids a cycle with persons) */
    rootPersonId: text(),
    clanId: text().references(() => clans.id, { onDelete: 'set null' }),
    coverMediaId: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('trees_owner_idx').on(t.ownerId), index('trees_privacy_idx').on(t.privacy)],
);

export const treeMembers = sqliteTable(
  'tree_members',
  {
    treeId: text()
      .notNull()
      .references(() => trees.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text({ enum: TREE_ROLES }).notNull(),
    /** "this is me": the person node this account is linked to */
    personId: text(),
    invitedBy: text(),
    joinedAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.treeId, t.userId] }),
    uniqueIndex('tree_members_person_uq').on(t.treeId, t.personId),
    index('tree_members_user_idx').on(t.userId),
  ],
);

export const invitations = sqliteTable(
  'invitations',
  {
    id: id(),
    treeId: text()
      .notNull()
      .references(() => trees.id, { onDelete: 'cascade' }),
    kind: text({ enum: ['email', 'link'] }).notNull(),
    token: text().notNull().unique(),
    email: text(),
    role: text({ enum: TREE_ROLES }).notNull().default('viewer'),
    personId: text(),
    message: text(),
    createdBy: text().notNull(),
    expiresAt: integer().notNull(),
    maxUses: integer(),
    useCount: integer().notNull().default(0),
    revokedAt: integer(),
    createdAt: createdAt(),
  },
  (t) => [index('invitations_tree_idx').on(t.treeId)],
);

export const friendAccess = sqliteTable(
  'friend_access',
  {
    treeId: text()
      .notNull()
      .references(() => trees.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    status: text({ enum: FRIEND_STATUSES }).notNull().default('pending'),
    requestedAt: createdAt(),
    decidedBy: text(),
    decidedAt: integer(),
  },
  (t) => [primaryKey({ columns: [t.treeId, t.userId] }), index('friend_access_user_idx').on(t.userId)],
);

export const persons = sqliteTable(
  'persons',
  {
    id: id(),
    treeId: text()
      .notNull()
      .references(() => trees.id, { onDelete: 'cascade' }),
    // names
    givenName: text().notNull(),
    patronymic: text(),
    clanName: text(),
    clanId: text().references(() => clans.id, { onDelete: 'set null' }),
    maidenName: text(),
    previousNames: text({ mode: 'json' }).$type<string[]>(),
    nicknames: text({ mode: 'json' }).$type<string[]>(),
    nameMongolScript: text(),
    gender: text({ enum: GENDERS }).notNull().default('unknown'),
    ethnicity: text(),
    // birth
    birthYear: integer(),
    birthMonth: integer(),
    birthDay: integer(),
    birthQualifier: qualifier(),
    birthPlace: text({ mode: 'json' }).$type<Place>(),
    // death
    isLiving: integer({ mode: 'boolean' }).notNull().default(true),
    deathYear: integer(),
    deathMonth: integer(),
    deathDay: integer(),
    deathQualifier: qualifier(),
    deathPlace: text({ mode: 'json' }).$type<Place>(),
    burialPlace: text({ mode: 'json' }).$type<Place>(),
    causeOfDeath: text(),
    memorial: text(),
    // life
    residence: text({ mode: 'json' }).$type<Place>(),
    education: text({ mode: 'json' }).$type<Education[]>(),
    occupation: text(),
    workplaces: text({ mode: 'json' }).$type<Workplace[]>(),
    militaryService: text(),
    awards: text({ mode: 'json' }).$type<Award[]>(),
    achievements: text(),
    hobbies: text(),
    favorites: text(),
    biography: text(),
    favoriteQuote: text(),
    messageToDescendants: text(),
    contacts: text({ mode: 'json' }).$type<Contacts>(),
    contactsVisibility: text({ enum: CONTACT_VISIBILITY }).notNull().default('private'),
    profileMediaId: text(),
    /** account that claimed this person ("this is me") */
    userId: text().references(() => users.id, { onDelete: 'set null' }),
    createdBy: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('persons_tree_idx').on(t.treeId),
    index('persons_user_idx').on(t.userId),
    index('persons_tree_name_idx').on(t.treeId, t.givenName),
  ],
);

export const personCustomFields = sqliteTable(
  'person_custom_fields',
  {
    id: id(),
    treeId: text()
      .notNull()
      .references(() => trees.id, { onDelete: 'cascade' }),
    personId: text()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    key: text().notNull(),
    value: text().notNull(),
    sortOrder: integer().notNull().default(0),
  },
  (t) => [index('custom_fields_person_idx').on(t.personId)],
);

export const parentChild = sqliteTable(
  'parent_child',
  {
    id: id(),
    treeId: text()
      .notNull()
      .references(() => trees.id, { onDelete: 'cascade' }),
    parentId: text()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    childId: text()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    type: text({ enum: PARENT_LINK_TYPES }).notNull().default('biological'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('parent_child_uq').on(t.parentId, t.childId),
    index('parent_child_child_idx').on(t.childId),
    index('parent_child_tree_idx').on(t.treeId),
  ],
);

export const partnerships = sqliteTable(
  'partnerships',
  {
    id: id(),
    treeId: text()
      .notNull()
      .references(() => trees.id, { onDelete: 'cascade' }),
    person1Id: text()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    person2Id: text()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
    status: text({ enum: PARTNERSHIP_STATUSES }).notNull().default('married'),
    startYear: integer(),
    startMonth: integer(),
    startDay: integer(),
    startQualifier: qualifier(),
    endYear: integer(),
    endMonth: integer(),
    endDay: integer(),
    endQualifier: qualifier(),
    /** order among a person's partnerships (1st, 2nd marriage…) */
    sortOrder: integer().notNull().default(0),
    notes: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index('partnerships_tree_idx').on(t.treeId),
    index('partnerships_p1_idx').on(t.person1Id),
    index('partnerships_p2_idx').on(t.person2Id),
  ],
);

export const events = sqliteTable(
  'events',
  {
    id: id(),
    treeId: text()
      .notNull()
      .references(() => trees.id, { onDelete: 'cascade' }),
    personId: text().references(() => persons.id, { onDelete: 'cascade' }),
    partnershipId: text().references(() => partnerships.id, { onDelete: 'cascade' }),
    type: text({ enum: EVENT_TYPES }).notNull(),
    title: text(),
    description: text(),
    dateYear: integer(),
    dateMonth: integer(),
    dateDay: integer(),
    dateQualifier: qualifier(),
    place: text({ mode: 'json' }).$type<Place>(),
    createdBy: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('events_tree_idx').on(t.treeId, t.dateYear), index('events_person_idx').on(t.personId)],
);

export const albums = sqliteTable(
  'albums',
  {
    id: id(),
    treeId: text()
      .notNull()
      .references(() => trees.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    description: text(),
    coverMediaId: text(),
    createdBy: text(),
    createdAt: createdAt(),
  },
  (t) => [index('albums_tree_idx').on(t.treeId)],
);

export const media = sqliteTable(
  'media',
  {
    id: id(),
    treeId: text()
      .notNull()
      .references(() => trees.id, { onDelete: 'cascade' }),
    albumId: text().references(() => albums.id, { onDelete: 'set null' }),
    kind: text({ enum: MEDIA_KINDS }).notNull(),
    r2Key: text().notNull(),
    thumbKey: text(),
    mimeType: text().notNull(),
    size: integer().notNull(),
    originalName: text().notNull(),
    title: text(),
    description: text(),
    category: text({ enum: MEDIA_CATEGORIES }).notNull().default('other'),
    dateYear: integer(),
    dateMonth: integer(),
    dateDay: integer(),
    dateQualifier: qualifier(),
    place: text(),
    width: integer(),
    height: integer(),
    durationSec: real(),
    status: text({ enum: ['pending', 'ready'] }).notNull().default('pending'),
    /** in-progress multipart upload id */
    uploadId: text(),
    uploadedBy: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index('media_tree_created_idx').on(t.treeId, t.createdAt),
    index('media_album_idx').on(t.albumId),
  ],
);

export const mediaPersons = sqliteTable(
  'media_persons',
  {
    mediaId: text()
      .notNull()
      .references(() => media.id, { onDelete: 'cascade' }),
    personId: text()
      .notNull()
      .references(() => persons.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.mediaId, t.personId] }), index('media_persons_person_idx').on(t.personId)],
);

export const stories = sqliteTable(
  'stories',
  {
    id: id(),
    treeId: text()
      .notNull()
      .references(() => trees.id, { onDelete: 'cascade' }),
    personId: text().references(() => persons.id, { onDelete: 'set null' }),
    title: text().notNull(),
    description: text(),
    body: text(),
    mediaId: text().references(() => media.id, { onDelete: 'set null' }),
    dateYear: integer(),
    dateMonth: integer(),
    dateDay: integer(),
    dateQualifier: qualifier(),
    createdBy: text().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('stories_tree_idx').on(t.treeId), index('stories_person_idx').on(t.personId)],
);

export const auditLog = sqliteTable(
  'audit_log',
  {
    id: id(),
    treeId: text()
      .notNull()
      .references(() => trees.id, { onDelete: 'cascade' }),
    userId: text(),
    entityType: text().notNull(),
    entityId: text().notNull(),
    action: text({ enum: AUDIT_ACTIONS }).notNull(),
    changes: text({ mode: 'json' }).$type<Record<string, [unknown, unknown]>>(),
    summary: text(),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_tree_created_idx').on(t.treeId, t.createdAt),
    index('audit_entity_idx').on(t.entityType, t.entityId),
  ],
);

export const notificationPrefs = sqliteTable('notification_prefs', {
  userId: text()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  emailEnabled: integer({ mode: 'boolean' }).notNull().default(true),
  pushEnabled: integer({ mode: 'boolean' }).notNull().default(false),
  daysBefore: integer().notNull().default(1),
  kinds: text({ mode: 'json' })
    .$type<ReminderKind[]>()
    .notNull()
    .default(sql`'["birthday","death_anniversary","wedding_anniversary"]'`),
  timezone: text().notNull().default('Asia/Ulaanbaatar'),
  updatedAt: updatedAt(),
});

export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text().notNull().unique(),
    p256dh: text().notNull(),
    auth: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [index('push_user_idx').on(t.userId)],
);

export const remindersSent = sqliteTable(
  'reminders_sent',
  {
    id: id(),
    userId: text()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text({ enum: REMINDER_KINDS }).notNull(),
    refId: text().notNull(),
    /** the anniversary date this reminder is for (yyyy-mm-dd) */
    occurrence: text().notNull(),
    /** 0 = on the day, N = N days before */
    daysBefore: integer().notNull(),
    channel: text({ enum: ['email', 'push'] }).notNull(),
    sentAt: createdAt(),
  },
  (t) => [uniqueIndex('reminders_sent_uq').on(t.userId, t.kind, t.refId, t.occurrence, t.daysBefore, t.channel)],
);

export type UserRow = typeof users.$inferSelect;
export type TreeRow = typeof trees.$inferSelect;
export type PersonRow = typeof persons.$inferSelect;
export type MediaRow = typeof media.$inferSelect;
export type PartnershipRow = typeof partnerships.$inferSelect;
export type EventRow = typeof events.$inferSelect;
export type StoryRow = typeof stories.$inferSelect;
