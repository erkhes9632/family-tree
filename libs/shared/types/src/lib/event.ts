import { z } from 'zod';
import { partialDateSchema, placeSchema, type PartialDate, type Place } from './common';
import { EVENT_TYPES, type EventType } from './enums';

export const eventInputSchema = z.object({
  personId: z.string().nullable().optional(),
  partnershipId: z.string().nullable().optional(),
  type: z.enum(EVENT_TYPES),
  title: z.string().max(200).nullable().optional(),
  description: z.string().max(5000).nullable().optional(),
  date: partialDateSchema.nullable().optional(),
  place: placeSchema.nullable().optional(),
});
export type EventInput = z.infer<typeof eventInputSchema>;

export interface EventDto {
  id: string;
  treeId: string;
  personId: string | null;
  partnershipId: string | null;
  type: EventType;
  title: string | null;
  description: string | null;
  date: PartialDate | null;
  place: Place | null;
}

/** Timeline entries merge stored events with facts derived from persons & partnerships. */
export interface TimelineEntry {
  key: string;
  source: 'event' | 'person' | 'partnership';
  type: EventType;
  date: PartialDate;
  personIds: string[];
  title: string | null;
  description: string | null;
  eventId: string | null;
}
