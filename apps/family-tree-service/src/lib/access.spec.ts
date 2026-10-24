import type { PersonDto, TreePrivacy, TreeRole } from '@super-project/types';
import { allows, computeAccess } from './access';
import { canSeeContacts, redactPerson, redactSummary } from './privacy';
import { invitationState } from '../routes/invitations';

const access = (privacy: TreePrivacy, role: TreeRole | null, friend: 'approved' | 'pending' | null = null) =>
  computeAccess({ privacy, role, friendStatus: friend, personId: role ? 'p_me' : null });

describe('computeAccess', () => {
  it.each`
    privacy      | role        | friend        | view     | edit     | manage
    ${'family'}  | ${null}     | ${null}       | ${false} | ${false} | ${false}
    ${'family'}  | ${null}     | ${'approved'} | ${false} | ${false} | ${false}
    ${'family'}  | ${'viewer'} | ${null}       | ${true}  | ${false} | ${false}
    ${'family'}  | ${'editor'} | ${null}       | ${true}  | ${true}  | ${false}
    ${'family'}  | ${'admin'}  | ${null}       | ${true}  | ${true}  | ${true}
    ${'friends'} | ${null}     | ${null}       | ${false} | ${false} | ${false}
    ${'friends'} | ${null}     | ${'pending'}  | ${false} | ${false} | ${false}
    ${'friends'} | ${null}     | ${'approved'} | ${true}  | ${false} | ${false}
    ${'public'}  | ${null}     | ${null}       | ${true}  | ${false} | ${false}
    ${'public'}  | ${'editor'} | ${null}       | ${true}  | ${true}  | ${false}
  `('$privacy / role=$role / friend=$friend', ({ privacy, role, friend, view, edit, manage }) => {
    const a = access(privacy, role, friend);
    expect([allows(a, 'view'), allows(a, 'edit'), allows(a, 'manage')]).toEqual([view, edit, manage]);
    expect(a.restricted).toBe(role === null);
  });

  it('does not expose a linked person id to non-members', () => {
    expect(computeAccess({ privacy: 'public', role: null, friendStatus: null, personId: 'x' }).personId).toBeNull();
  });
});

const person = (over: Partial<PersonDto> = {}): PersonDto => ({
  id: 'p1',
  treeId: 't',
  givenName: 'Бат',
  patronymic: null,
  clanName: null,
  gender: 'male',
  isLiving: true,
  birthDate: { year: 1990, month: 5, day: 1, qualifier: 'exact' },
  deathDate: null,
  photoUrl: null,
  userId: 'u_bat',
  redacted: false,
  clanId: null,
  maidenName: null,
  previousNames: [],
  nicknames: [],
  nameMongolScript: null,
  ethnicity: null,
  birthPlace: { aimag: 'Хэнтий' },
  deathPlace: null,
  burialPlace: null,
  causeOfDeath: null,
  memorial: null,
  residence: { text: 'Улаанбаатар' },
  education: [],
  occupation: 'Инженер',
  workplaces: [],
  militaryService: null,
  awards: [],
  achievements: null,
  hobbies: null,
  favorites: null,
  biography: 'bio',
  favoriteQuote: null,
  messageToDescendants: null,
  contacts: { phone: '99112233' },
  contactsVisibility: 'private',
  profileMediaId: null,
  customFields: [{ id: 'c', key: 'k', value: 'v', sortOrder: 0 }],
  createdAt: 0,
  updatedAt: 0,
  ...over,
});

describe('privacy redaction', () => {
  it('hides sensitive details of living persons from non-members (public tree)', () => {
    const out = redactPerson(person(), access('public', null), null);
    expect(out.birthDate).toEqual({ year: 1990, month: null, day: null, qualifier: 'exact' });
    expect(out.birthPlace).toBeNull();
    expect(out.residence).toBeNull();
    expect(out.contacts).toBeNull();
    expect(out.customFields).toEqual([]);
    expect(out.redacted).toBe(true);
    expect(out.biography).toBe('bio');
  });

  it('hides living details from approved friends too', () => {
    expect(redactPerson(person(), access('friends', null, 'approved'), 'u_friend').birthPlace).toBeNull();
  });

  it('keeps deceased persons fully visible in public trees', () => {
    const dead = person({ isLiving: false, deathDate: { year: 2010, qualifier: 'exact' } });
    const out = redactPerson(dead, access('public', null), null);
    expect(out.birthDate?.day).toBe(1);
    expect(out.birthPlace).toEqual({ aimag: 'Хэнтий' });
    expect(out.redacted).toBe(false);
  });

  it('private contacts: only admins and the person themselves', () => {
    const p = person();
    expect(canSeeContacts(p, access('family', 'viewer'), 'u_other')).toBe(false);
    expect(canSeeContacts(p, access('family', 'editor'), 'u_other')).toBe(false);
    expect(canSeeContacts(p, access('family', 'admin'), 'u_other')).toBe(true);
    expect(canSeeContacts(p, access('family', 'viewer'), 'u_bat')).toBe(true);
  });

  it('members-visible contacts: any member, never outsiders', () => {
    const p = person({ contactsVisibility: 'members' });
    expect(canSeeContacts(p, access('family', 'viewer'), 'u_other')).toBe(true);
    expect(canSeeContacts(p, access('public', null), 'u_other')).toBe(false);
  });

  it('never shows contacts of deceased people', () => {
    expect(canSeeContacts(person({ isLiving: false }), access('family', 'admin'), 'u')).toBe(false);
  });

  it('members see full summaries; outsiders get year-only birth dates', () => {
    const s = person();
    expect(redactSummary(s, access('family', 'viewer')).birthDate?.day).toBe(1);
    expect(redactSummary(s, access('public', null)).birthDate?.day).toBeNull();
  });
});

describe('invitationState', () => {
  const base = { revokedAt: null, expiresAt: Date.now() + 1000, maxUses: null, useCount: 0 };
  it('validates expiry, revocation and use limits', () => {
    expect(invitationState(base)).toBe('valid');
    expect(invitationState({ ...base, revokedAt: 1 })).toBe('revoked');
    expect(invitationState({ ...base, expiresAt: Date.now() - 1 })).toBe('expired');
    expect(invitationState({ ...base, maxUses: 1, useCount: 1 })).toBe('used');
    expect(invitationState({ ...base, maxUses: 5, useCount: 4 })).toBe('valid');
  });
});
