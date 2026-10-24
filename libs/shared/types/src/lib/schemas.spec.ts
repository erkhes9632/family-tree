import { addRelativeSchema, createInvitationSchema, partialDateSchema, personInputSchema } from '../index';

describe('shared schemas', () => {
  it('accepts year-only and approximate dates', () => {
    expect(partialDateSchema.parse({ year: 1920, qualifier: 'about' })).toEqual({ year: 1920, qualifier: 'about' });
    expect(partialDateSchema.parse({ year: 1900 }).qualifier).toBe('exact');
  });

  it('rejects a day without a month', () => {
    expect(partialDateSchema.safeParse({ year: 1950, day: 3 }).success).toBe(false);
  });

  it('requires a given name for a person', () => {
    expect(personInputSchema.safeParse({}).success).toBe(false);
    const p = personInputSchema.parse({ givenName: 'Тэмүүжин' });
    expect(p.gender).toBe('unknown');
    expect(p.isLiving).toBe(true);
    expect(p.contactsVisibility).toBe('private');
  });

  it('add-relative requires exactly one of person / existingPersonId', () => {
    expect(addRelativeSchema.safeParse({ relation: 'child' }).success).toBe(false);
    expect(
      addRelativeSchema.safeParse({ relation: 'child', existingPersonId: 'a', person: { givenName: 'x' } }).success,
    ).toBe(false);
    expect(addRelativeSchema.safeParse({ relation: 'child', existingPersonId: 'a' }).success).toBe(true);
  });

  it('email invitations need an email', () => {
    expect(createInvitationSchema.safeParse({ kind: 'email' }).success).toBe(false);
    expect(createInvitationSchema.safeParse({ kind: 'link' }).success).toBe(true);
  });
});
