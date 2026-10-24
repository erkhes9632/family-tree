import { z } from 'zod';
import { partialDateSchema, placeSchema, type PartialDate, type Place } from './common';
import {
  CONTACT_VISIBILITY,
  GENDERS,
  PARENT_LINK_TYPES,
  PARTNERSHIP_STATUSES,
  RELATIVE_KINDS,
  type ContactVisibility,
  type Gender,
  type ParentLinkType,
  type PartnershipStatus,
} from './enums';

const str = (max: number) => z.string().max(max).nullable().optional();

export const educationSchema = z.object({
  institution: z.string().max(200),
  degree: str(120),
  field: str(120),
  fromYear: z.number().int().nullable().optional(),
  toYear: z.number().int().nullable().optional(),
});
export const workplaceSchema = z.object({
  organization: z.string().max(200),
  position: str(120),
  fromYear: z.number().int().nullable().optional(),
  toYear: z.number().int().nullable().optional(),
});
export const awardSchema = z.object({
  title: z.string().max(200),
  year: z.number().int().nullable().optional(),
  description: str(1000),
});
export const contactsSchema = z.object({
  phone: str(60),
  email: str(200),
  address: str(300),
  social: str(300),
});
export type Education = z.infer<typeof educationSchema>;
export type Workplace = z.infer<typeof workplaceSchema>;
export type Award = z.infer<typeof awardSchema>;
export type Contacts = z.infer<typeof contactsSchema>;

export const personInputSchema = z.object({
  givenName: z.string().trim().min(1).max(120),
  patronymic: str(120),
  clanName: str(120),
  clanId: z.string().nullable().optional(),
  maidenName: str(120),
  previousNames: z.array(z.string().max(120)).max(20).optional(),
  nicknames: z.array(z.string().max(120)).max(20).optional(),
  nameMongolScript: str(200),
  gender: z.enum(GENDERS).default('unknown'),
  ethnicity: str(120),
  birthDate: partialDateSchema.nullable().optional(),
  birthPlace: placeSchema.nullable().optional(),
  isLiving: z.boolean().default(true),
  deathDate: partialDateSchema.nullable().optional(),
  deathPlace: placeSchema.nullable().optional(),
  burialPlace: placeSchema.nullable().optional(),
  causeOfDeath: str(500),
  memorial: str(10000),
  residence: placeSchema.nullable().optional(),
  education: z.array(educationSchema).max(30).optional(),
  occupation: str(200),
  workplaces: z.array(workplaceSchema).max(50).optional(),
  militaryService: str(2000),
  awards: z.array(awardSchema).max(100).optional(),
  achievements: str(5000),
  hobbies: str(2000),
  favorites: str(2000),
  biography: str(50000),
  favoriteQuote: str(1000),
  messageToDescendants: str(10000),
  contacts: contactsSchema.nullable().optional(),
  contactsVisibility: z.enum(CONTACT_VISIBILITY).default('private'),
  profileMediaId: z.string().nullable().optional(),
});
export type PersonInput = z.infer<typeof personInputSchema>;

/** PATCH body: every field optional, no defaults applied. */
export const personUpdateSchema = personInputSchema.partial().extend({
  gender: z.enum(GENDERS).optional(),
  isLiving: z.boolean().optional(),
  contactsVisibility: z.enum(CONTACT_VISIBILITY).optional(),
});
export type PersonUpdate = z.infer<typeof personUpdateSchema>;

export const customFieldsSchema = z.object({
  fields: z
    .array(z.object({ key: z.string().trim().min(1).max(100), value: z.string().max(5000) }))
    .max(100),
});

export interface CustomField {
  id: string;
  key: string;
  value: string;
  sortOrder: number;
}

export interface PersonSummary {
  id: string;
  givenName: string;
  patronymic: string | null;
  clanName: string | null;
  gender: Gender;
  isLiving: boolean;
  birthDate: PartialDate | null;
  deathDate: PartialDate | null;
  photoUrl: string | null;
  userId: string | null;
  redacted: boolean;
}

export interface PersonDto extends PersonSummary {
  treeId: string;
  clanId: string | null;
  maidenName: string | null;
  previousNames: string[];
  nicknames: string[];
  nameMongolScript: string | null;
  ethnicity: string | null;
  birthPlace: Place | null;
  deathPlace: Place | null;
  burialPlace: Place | null;
  causeOfDeath: string | null;
  memorial: string | null;
  residence: Place | null;
  education: Education[];
  occupation: string | null;
  workplaces: Workplace[];
  militaryService: string | null;
  awards: Award[];
  achievements: string | null;
  hobbies: string | null;
  favorites: string | null;
  biography: string | null;
  favoriteQuote: string | null;
  messageToDescendants: string | null;
  contacts: Contacts | null;
  contactsVisibility: ContactVisibility;
  profileMediaId: string | null;
  customFields: CustomField[];
  createdAt: number;
  updatedAt: number;
}

export const parentChildInputSchema = z.object({
  parentId: z.string(),
  childId: z.string(),
  type: z.enum(PARENT_LINK_TYPES).default('biological'),
});
export const parentChildUpdateSchema = z.object({ type: z.enum(PARENT_LINK_TYPES) });

export interface ParentChildLink {
  id: string;
  parentId: string;
  childId: string;
  type: ParentLinkType;
}

export const partnershipInputSchema = z.object({
  person1Id: z.string(),
  person2Id: z.string(),
  status: z.enum(PARTNERSHIP_STATUSES).default('married'),
  startDate: partialDateSchema.nullable().optional(),
  endDate: partialDateSchema.nullable().optional(),
  sortOrder: z.number().int().min(0).max(100).optional(),
  notes: str(2000),
});
export const partnershipUpdateSchema = partnershipInputSchema
  .omit({ person1Id: true, person2Id: true })
  .partial()
  .extend({ status: z.enum(PARTNERSHIP_STATUSES).optional() });

export interface PartnershipDto {
  id: string;
  person1Id: string;
  person2Id: string;
  status: PartnershipStatus;
  startDate: PartialDate | null;
  endDate: PartialDate | null;
  sortOrder: number;
  notes: string | null;
}

/** Add a relative to an existing person in one request. */
export const addRelativeSchema = z
  .object({
    relation: z.enum(RELATIVE_KINDS),
    /** create a new person… */
    person: personInputSchema.optional(),
    /** …or link someone already in the tree */
    existingPersonId: z.string().optional(),
    linkType: z.enum(PARENT_LINK_TYPES).default('biological'),
    partnershipStatus: z.enum(PARTNERSHIP_STATUSES).default('married'),
    /** for child: the other parent (must be a partner of the anchor) */
    otherParentId: z.string().nullable().optional(),
  })
  .refine((v) => !!v.person !== !!v.existingPersonId, {
    message: 'provide exactly one of person or existingPersonId',
  });
export type AddRelativeInput = z.infer<typeof addRelativeSchema>;

export interface TreeGraph {
  persons: PersonSummary[];
  parentChild: ParentChildLink[];
  partnerships: PartnershipDto[];
}
