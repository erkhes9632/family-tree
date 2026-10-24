import type {
  DateQualifier,
  EventDto,
  PartialDate,
  PartnershipDto,
  PersonDto,
  PersonInput,
  PersonSummary,
  PersonUpdate,
  TreeDto,
} from '@super-project/types';
import type { EventRow, PartnershipRow, PersonRow, TreeRow } from '../db/schema';

type DateCols = { year: number | null; month: number | null; day: number | null; qualifier: DateQualifier | null };

export function toPartialDate(c: DateCols): PartialDate | null {
  if (c.year == null) return null;
  return { year: c.year, month: c.month, day: c.day, qualifier: c.qualifier ?? 'exact' };
}

/** Flatten a partial date into `<prefix>Year/Month/Day/Qualifier` columns. */
export function dateCols<P extends string>(prefix: P, d: PartialDate | null | undefined) {
  return {
    [`${prefix}Year`]: d?.year ?? null,
    [`${prefix}Month`]: d?.year != null ? (d.month ?? null) : null,
    [`${prefix}Day`]: d?.year != null && d.month != null ? (d.day ?? null) : null,
    [`${prefix}Qualifier`]: d?.year != null ? (d.qualifier ?? 'exact') : null,
  } as Record<`${P}Year` | `${P}Month` | `${P}Day`, number | null> & Record<`${P}Qualifier`, DateQualifier | null>;
}

export function toTreeDto(t: TreeRow, personCount?: number): TreeDto {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    privacy: t.privacy,
    ownerId: t.ownerId,
    rootPersonId: t.rootPersonId,
    clanId: t.clanId,
    coverMediaId: t.coverMediaId,
    personCount,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

export function toPersonSummary(p: PersonRow, photoUrl: string | null = null): PersonSummary {
  return {
    id: p.id,
    givenName: p.givenName,
    patronymic: p.patronymic,
    clanName: p.clanName,
    gender: p.gender,
    isLiving: p.isLiving,
    birthDate: toPartialDate({ year: p.birthYear, month: p.birthMonth, day: p.birthDay, qualifier: p.birthQualifier }),
    deathDate: toPartialDate({ year: p.deathYear, month: p.deathMonth, day: p.deathDay, qualifier: p.deathQualifier }),
    photoUrl,
    userId: p.userId,
    redacted: false,
  };
}

export function toPersonDto(p: PersonRow, extra: Pick<PersonDto, 'customFields'> & { photoUrl: string | null }): PersonDto {
  return {
    ...toPersonSummary(p, extra.photoUrl),
    treeId: p.treeId,
    clanId: p.clanId,
    maidenName: p.maidenName,
    previousNames: p.previousNames ?? [],
    nicknames: p.nicknames ?? [],
    nameMongolScript: p.nameMongolScript,
    ethnicity: p.ethnicity,
    birthPlace: p.birthPlace,
    deathPlace: p.deathPlace,
    burialPlace: p.burialPlace,
    causeOfDeath: p.causeOfDeath,
    memorial: p.memorial,
    residence: p.residence,
    education: p.education ?? [],
    occupation: p.occupation,
    workplaces: p.workplaces ?? [],
    militaryService: p.militaryService,
    awards: p.awards ?? [],
    achievements: p.achievements,
    hobbies: p.hobbies,
    favorites: p.favorites,
    biography: p.biography,
    favoriteQuote: p.favoriteQuote,
    messageToDescendants: p.messageToDescendants,
    contacts: p.contacts,
    contactsVisibility: p.contactsVisibility,
    profileMediaId: p.profileMediaId,
    customFields: extra.customFields,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

/** Convert a validated create/update body into column values (only keys present in the input). */
export function personValues(input: PersonInput | PersonUpdate) {
  const { birthDate, deathDate, ...rest } = input;
  const out: Record<string, unknown> = { ...rest };
  if ('birthDate' in input) Object.assign(out, dateCols('birth', birthDate));
  if ('deathDate' in input) Object.assign(out, dateCols('death', deathDate));
  if (input.isLiving === true) Object.assign(out, dateCols('death', null), { deathPlace: null, burialPlace: null, causeOfDeath: null });
  return out as Partial<PersonRow>;
}

export function toPartnershipDto(p: PartnershipRow): PartnershipDto {
  return {
    id: p.id,
    person1Id: p.person1Id,
    person2Id: p.person2Id,
    status: p.status,
    startDate: toPartialDate({ year: p.startYear, month: p.startMonth, day: p.startDay, qualifier: p.startQualifier }),
    endDate: toPartialDate({ year: p.endYear, month: p.endMonth, day: p.endDay, qualifier: p.endQualifier }),
    sortOrder: p.sortOrder,
    notes: p.notes,
  };
}

export function toEventDto(e: EventRow): EventDto {
  return {
    id: e.id,
    treeId: e.treeId,
    personId: e.personId,
    partnershipId: e.partnershipId,
    type: e.type,
    title: e.title,
    description: e.description,
    date: toPartialDate({ year: e.dateYear, month: e.dateMonth, day: e.dateDay, qualifier: e.dateQualifier }),
    place: e.place,
  };
}

/** Field-level diff for the audit log (ignores bookkeeping columns). */
export function diff(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const ignore = new Set(['updatedAt', 'createdAt']);
  const out: Record<string, [unknown, unknown]> = {};
  const keys = new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]);
  for (const k of keys) {
    if (ignore.has(k)) continue;
    const norm = (v: unknown) => (Array.isArray(v) && v.length === 0) || v === '' || v === undefined ? null : v;
    const a = norm(before?.[k]);
    const b = norm(after?.[k]);
    if (JSON.stringify(a) !== JSON.stringify(b)) out[k] = [a, b];
  }
  return out;
}
