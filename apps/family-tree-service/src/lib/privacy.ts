import type { PersonDto, PersonSummary, ViewerAccess } from '@super-project/types';

/** Who can see a person's contacts. */
export function canSeeContacts(
  person: Pick<PersonDto, 'contactsVisibility' | 'userId' | 'isLiving'>,
  access: ViewerAccess,
  viewerId: string | null,
): boolean {
  if (!person.isLiving) return false;
  if (viewerId && person.userId === viewerId) return true;
  if (access.restricted) return false;
  if (person.contactsVisibility === 'members') return true;
  return access.canManage;
}

/** Year only, for non-members looking at living people. */
function yearOnly<T extends PersonSummary['birthDate']>(d: T): T {
  if (!d) return d;
  return { year: d.year ?? null, month: null, day: null, qualifier: d.qualifier } as T;
}

export function redactSummary(p: PersonSummary, access: ViewerAccess): PersonSummary {
  if (!access.restricted || !p.isLiving) return p;
  return { ...p, birthDate: yearOnly(p.birthDate), redacted: true };
}

export function redactPerson(p: PersonDto, access: ViewerAccess, viewerId: string | null): PersonDto {
  const out: PersonDto = { ...p };
  if (!canSeeContacts(p, access, viewerId)) out.contacts = null;
  if (access.restricted && p.isLiving) {
    out.birthDate = yearOnly(p.birthDate);
    out.birthPlace = null;
    out.residence = null;
    out.contacts = null;
    out.customFields = [];
    out.redacted = true;
  }
  return out;
}
