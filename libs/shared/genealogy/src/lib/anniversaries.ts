import type { PartialDate, PartnershipDto, PersonSummary, ReminderKind } from '@super-project/types';
import { type CalendarDay, dayNumber, daysInMonth, hasYear } from './dates';

export interface AnniversarySource {
  kind: ReminderKind;
  /** person id or partnership id */
  refId: string;
  personIds: string[];
  date: PartialDate;
}

export interface UpcomingAnniversary extends AnniversarySource {
  /** the calendar day it falls on */
  on: CalendarDay;
  daysUntil: number;
  /** years since the original date, when the year is known */
  years: number | null;
  /** round number of years (10, 20, … 100) */
  isJubilee: boolean;
}

/** Collect anniversary sources from people and partnerships (only dates with month + day). */
export function anniversarySources(persons: PersonSummary[], partnerships: PartnershipDto[]): AnniversarySource[] {
  const out: AnniversarySource[] = [];
  const living = new Map(persons.map((p) => [p.id, p.isLiving]));
  for (const p of persons) {
    if (p.birthDate?.month && p.birthDate.day && p.birthDate.qualifier === 'exact') {
      out.push({ kind: 'birthday', refId: p.id, personIds: [p.id], date: p.birthDate });
    }
    if (!p.isLiving && p.deathDate?.month && p.deathDate.day && p.deathDate.qualifier === 'exact') {
      out.push({ kind: 'death_anniversary', refId: p.id, personIds: [p.id], date: p.deathDate });
    }
  }
  for (const pt of partnerships) {
    const d = pt.startDate;
    if (pt.status !== 'married' || !d?.month || !d.day || d.qualifier !== 'exact') continue;
    if (pt.endDate?.year) continue;
    if (!living.get(pt.person1Id) || !living.get(pt.person2Id)) continue;
    out.push({ kind: 'wedding_anniversary', refId: pt.id, personIds: [pt.person1Id, pt.person2Id], date: d });
  }
  return out;
}

function occurrenceInYear(date: PartialDate, year: number): CalendarDay {
  const month = date.month as number;
  // Feb 29 falls on Feb 28 in non-leap years
  const day = Math.min(date.day as number, daysInMonth(year, month));
  return { year, month, day };
}

/** Anniversaries falling within [today, today + daysAhead], soonest first. */
export function upcomingAnniversaries(
  sources: AnniversarySource[],
  today: CalendarDay,
  daysAhead: number,
): UpcomingAnniversary[] {
  const t = dayNumber(today);
  const out: UpcomingAnniversary[] = [];
  for (const s of sources) {
    if (!s.date.month || !s.date.day) continue;
    let on = occurrenceInYear(s.date, today.year);
    if (dayNumber(on) < t) on = occurrenceInYear(s.date, today.year + 1);
    const daysUntil = dayNumber(on) - t;
    if (daysUntil > daysAhead) continue;
    const years = hasYear(s.date) ? on.year - s.date.year : null;
    if (years != null && years <= 0 && s.kind !== 'birthday') continue;
    out.push({ ...s, on, daysUntil, years, isJubilee: years != null && years > 0 && years % 10 === 0 });
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

/** Round anniversaries for a timeline year, e.g. 100th birth anniversary in 2038. */
export function jubileesInYear(sources: AnniversarySource[], year: number, step = 10): (AnniversarySource & { years: number })[] {
  const out: (AnniversarySource & { years: number })[] = [];
  for (const s of sources) {
    if (!hasYear(s.date)) continue;
    const years = year - s.date.year;
    if (years > 0 && years % step === 0) out.push({ ...s, years });
  }
  return out;
}
