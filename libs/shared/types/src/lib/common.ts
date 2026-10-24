import { z } from 'zod';
import { DATE_QUALIFIERS } from './enums';

/** Partial / approximate date: year only, year+month, "about 1920", "before 1900". */
export const partialDateSchema = z
  .object({
    year: z.number().int().min(1).max(3000).nullable().optional(),
    month: z.number().int().min(1).max(12).nullable().optional(),
    day: z.number().int().min(1).max(31).nullable().optional(),
    qualifier: z.enum(DATE_QUALIFIERS).default('exact'),
  })
  .refine((d) => !(d.day != null && d.month == null), { message: 'day requires month', path: ['day'] });
export type PartialDate = z.infer<typeof partialDateSchema>;

export const placeSchema = z.object({
  text: z.string().max(300).nullable().optional(),
  country: z.string().max(100).nullable().optional(),
  aimag: z.string().max(100).nullable().optional(),
  sum: z.string().max(100).nullable().optional(),
  bag: z.string().max(100).nullable().optional(),
});
export type Place = z.infer<typeof placeSchema>;

export const idSchema = z.string().min(1).max(64);

export const paginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});

export interface Page<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}
