import type { PersonSummary } from '@super-project/types';

/** Mongolian short form: patronymic initial + given name, e.g. "Б.Батболд". */
export function shortName(p: Pick<PersonSummary, 'givenName' | 'patronymic'>): string {
  const initial = p.patronymic?.trim()?.[0];
  return initial ? `${initial.toUpperCase()}.${p.givenName}` : p.givenName;
}

/** Full form: "Боржигин Батын Болд" style ordering (clan, patronymic, given). */
export function fullName(p: Pick<PersonSummary, 'givenName' | 'patronymic' | 'clanName'>): string {
  return [p.clanName, p.patronymic, p.givenName].filter((x) => x && x.trim()).join(' ');
}
