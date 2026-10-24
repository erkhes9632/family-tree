import { ageInYears, comparePartialDates, formatPartialDate, lifeSpanLabel, parsePartialDate, todayInTimeZone } from './dates';

describe('parsePartialDate', () => {
  it.each([
    ['1920', { year: 1920, month: null, day: null, qualifier: 'exact' }],
    ['1950-03', { year: 1950, month: 3, day: null, qualifier: 'exact' }],
    ['1950.03.12', { year: 1950, month: 3, day: 12, qualifier: 'exact' }],
    ['12.03.1950', { year: 1950, month: 3, day: 12, qualifier: 'exact' }],
    ['about 1920', { year: 1920, month: null, day: null, qualifier: 'about' }],
    ['~1920', { year: 1920, month: null, day: null, qualifier: 'about' }],
    ['before 1900', { year: 1900, month: null, day: null, qualifier: 'before' }],
    ['after 1945', { year: 1945, month: null, day: null, qualifier: 'after' }],
    ['est. 1910', { year: 1910, month: null, day: null, qualifier: 'estimated' }],
    ['1920 орчим', { year: 1920, month: null, day: null, qualifier: 'about' }],
    ['ойролцоогоор 1920', { year: 1920, month: null, day: null, qualifier: 'about' }],
    ['1900 оноос өмнө', { year: 1900, month: null, day: null, qualifier: 'before' }],
    ['1900-с өмнө', { year: 1900, month: null, day: null, qualifier: 'before' }],
    ['1960 оноос хойш', { year: 1960, month: null, day: null, qualifier: 'after' }],
  ])('%s', (input, expected) => {
    expect(parsePartialDate(input)).toEqual(expected);
  });

  it('rejects invalid input', () => {
    expect(parsePartialDate('')).toBeNull();
    expect(parsePartialDate('hello')).toBeNull();
    expect(parsePartialDate('1950-13')).toBeNull();
    expect(parsePartialDate('2023-02-29')).toBeNull();
    expect(parsePartialDate('2024-02-29')).not.toBeNull();
  });

  it('round-trips its own Mongolian formatting', () => {
    for (const s of ['1920', 'about 1920', 'before 1900', '1950-03-12']) {
      const d = parsePartialDate(s);
      expect(parsePartialDate(formatPartialDate(d, 'mn'))).toEqual(d);
    }
  });
});

describe('formatting and comparison', () => {
  it('formats both locales', () => {
    expect(formatPartialDate({ year: 1938, month: 5, day: 12, qualifier: 'exact' }, 'en')).toBe('12 May 1938');
    expect(formatPartialDate({ year: 1938, month: 5, day: 12, qualifier: 'exact' }, 'mn')).toBe('1938.05.12');
    expect(formatPartialDate({ year: 1920, qualifier: 'about' }, 'en')).toBe('c. 1920');
    expect(formatPartialDate(null)).toBe('');
  });

  it('builds life span labels', () => {
    const b = { year: 1938, qualifier: 'exact' as const };
    const d = { year: 2010, qualifier: 'exact' as const };
    expect(lifeSpanLabel(b, d, false)).toBe('1938–2010');
    expect(lifeSpanLabel(b, null, true)).toBe('1938–');
    expect(lifeSpanLabel({ year: 1920, qualifier: 'about' }, null, false)).toBe('~1920–?');
  });

  it('sorts unknown dates last and "before" ahead of exact', () => {
    const list = [null, { year: 1900, qualifier: 'exact' as const }, { year: 1900, qualifier: 'before' as const }];
    list.sort(comparePartialDates);
    expect(list).toEqual([{ year: 1900, qualifier: 'before' }, { year: 1900, qualifier: 'exact' }, null]);
  });

  it('computes age', () => {
    expect(ageInYears({ year: 1990, month: 6, day: 15, qualifier: 'exact' }, { year: 2026, month: 6, day: 14 })).toBe(35);
    expect(ageInYears({ year: 1990, month: 6, day: 15, qualifier: 'exact' }, { year: 2026, month: 6, day: 15 })).toBe(36);
  });

  it('resolves today in Ulaanbaatar', () => {
    // 2026-10-22T20:00Z is already Oct 23, 04:00 in UB (UTC+8)
    expect(todayInTimeZone('Asia/Ulaanbaatar', new Date('2026-10-22T20:00:00Z'))).toEqual({ year: 2026, month: 10, day: 23, hour: 4 });
    expect(todayInTimeZone('Not/AZone', new Date('2026-10-22T20:00:00Z')).day).toBe(23);
  });
});
