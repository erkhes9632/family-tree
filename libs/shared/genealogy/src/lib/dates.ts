import type { DateQualifier, Locale, PartialDate } from '@super-project/types';

const EN_MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function hasYear(d: PartialDate | null | undefined): d is PartialDate & { year: number } {
  return !!d && typeof d.year === 'number';
}

/**
 * Parse free-text date input into a structured partial date.
 * Accepts: "1920", "1950-03", "1950-03-12", "1950.03.12", "12.03.1950",
 * "about 1920", "~1920", "c. 1920", "before 1900", "after 1900", "est. 1910",
 * and Mongolian forms: "1920 орчим", "ойролцоогоор 1920", "1900 оноос өмнө", "1900 оноос хойш".
 * Returns null when nothing date-like is found.
 */
export function parsePartialDate(input: string): PartialDate | null {
  let s = input.trim().toLowerCase();
  if (!s) return null;

  let qualifier: DateQualifier = 'exact';
  const rules: [RegExp, DateQualifier][] = [
    [/^(about|abt\.?|circa|ca\.?|c\.|~|ойролцоогоор)\s*/u, 'about'],
    [/\s*(орчим|орчимд|гаруй)$/u, 'about'],
    [/^(before|bef\.?|<)\s*/u, 'before'],
    [/\s*(оноос|оны)?\s*өмнө$/u, 'before'],
    [/^(after|aft\.?|>)\s*/u, 'after'],
    [/\s*(оноос|оны)?\s*хойш$/u, 'after'],
    [/^(est\.?|estimated|тооцоолсон)\s*/u, 'estimated'],
  ];
  for (const [re, q] of rules) {
    if (re.test(s)) {
      qualifier = q;
      s = s.replace(re, '').trim();
      break;
    }
  }
  s = s.replace(/-(с|аас|ээс|оос|өөс)$/u, '').replace(/\s*(он|оны|онд)$/u, '').trim();

  let m = s.match(/^(\d{3,4})(?:[-./](\d{1,2})(?:[-./](\d{1,2}))?)?$/);
  if (m) {
    return build(Number(m[1]), m[2] ? Number(m[2]) : null, m[3] ? Number(m[3]) : null, qualifier);
  }
  m = s.match(/^(\d{1,2})[-./](\d{1,2})[-./](\d{4})$/);
  if (m) return build(Number(m[3]), Number(m[2]), Number(m[1]), qualifier);
  return null;
}

function build(year: number, month: number | null, day: number | null, qualifier: DateQualifier): PartialDate | null {
  if (month != null && (month < 1 || month > 12)) return null;
  if (day != null && (day < 1 || day > daysInMonth(year, month ?? 1))) return null;
  return { year, month, day, qualifier };
}

export function isLeapYear(y: number): boolean {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
}

export function daysInMonth(year: number, month: number): number {
  return [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1] ?? 31;
}

/** Numeric sort key (yyyymmdd); unknown parts sort to the middle of their range. */
export function dateSortKey(d: PartialDate | null | undefined): number | null {
  if (!hasYear(d)) return null;
  const month = d.month ?? 6;
  const day = d.day ?? 15;
  let key = d.year * 10000 + month * 100 + day;
  if (d.qualifier === 'before') key -= 1;
  if (d.qualifier === 'after') key += 1;
  return key;
}

export function comparePartialDates(a: PartialDate | null | undefined, b: PartialDate | null | undefined): number {
  const ka = dateSortKey(a);
  const kb = dateSortKey(b);
  if (ka == null && kb == null) return 0;
  if (ka == null) return 1;
  if (kb == null) return -1;
  return ka - kb;
}

export function formatPartialDate(d: PartialDate | null | undefined, locale: Locale = 'mn'): string {
  if (!hasYear(d)) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  let core: string;
  if (locale === 'mn') {
    core = d.month ? `${d.year}.${pad(d.month)}${d.day ? `.${pad(d.day)}` : ''}` : `${d.year}`;
    switch (d.qualifier) {
      case 'about':
        return `${core} орчим`;
      case 'before':
        return `${core}-с өмнө`;
      case 'after':
        return `${core}-с хойш`;
      case 'estimated':
        return `${core} (тооцоолсон)`;
      default:
        return core;
    }
  }
  core = d.month ? `${d.day ? `${d.day} ` : ''}${EN_MONTHS[d.month - 1]} ${d.year}` : `${d.year}`;
  switch (d.qualifier) {
    case 'about':
      return `c. ${core}`;
    case 'before':
      return `before ${core}`;
    case 'after':
      return `after ${core}`;
    case 'estimated':
      return `est. ${core}`;
    default:
      return core;
  }
}

/** "1938–2010", "1938–", "c.1920–1990", "–2001" */
export function lifeSpanLabel(
  birth: PartialDate | null | undefined,
  death: PartialDate | null | undefined,
  isLiving: boolean,
): string {
  const y = (d: PartialDate | null | undefined) =>
    hasYear(d) ? `${d.qualifier === 'about' || d.qualifier === 'estimated' ? '~' : ''}${d.year}` : '';
  const b = y(birth);
  const dd = y(death);
  if (isLiving) return b ? `${b}–` : '';
  if (!b && !dd) return '†';
  return `${b}–${dd || '?'}`;
}

/** Age in whole years at a given date (or today). Null when not computable. */
export function ageInYears(
  birth: PartialDate | null | undefined,
  at: { year: number; month: number; day: number },
): number | null {
  if (!hasYear(birth)) return null;
  let age = at.year - birth.year;
  if (birth.month != null) {
    if (at.month < birth.month || (at.month === birth.month && birth.day != null && at.day < birth.day)) age -= 1;
  }
  return age;
}

export interface CalendarDay {
  year: number;
  month: number;
  day: number;
}

/** Today's calendar date in an IANA timezone (default Asia/Ulaanbaatar). */
export function todayInTimeZone(timeZone = 'Asia/Ulaanbaatar', now: Date = new Date()): CalendarDay & { hour: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      hourCycle: 'h23',
    }).formatToParts(now);
  } catch {
    return todayInTimeZone('Asia/Ulaanbaatar', now);
  }
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') };
}

export function dayNumber(d: CalendarDay): number {
  return Math.floor(Date.UTC(d.year, d.month - 1, d.day) / 86400000);
}

export function isoDay(d: CalendarDay): string {
  return `${d.year}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')}`;
}
