import { sampleFamily } from './fixtures';
import { anniversarySources, jubileesInYear, upcomingAnniversaries, type AnniversarySource } from './anniversaries';

const src = (kind: AnniversarySource['kind'], year: number | null, month: number, day: number, refId = 'x'): AnniversarySource => ({
  kind,
  refId,
  personIds: [refId],
  date: { year, month, day, qualifier: 'exact' },
});

describe('upcomingAnniversaries', () => {
  const today = { year: 2026, month: 12, day: 28 };

  it('finds events in the window, wrapping over new year', () => {
    const list = upcomingAnniversaries(
      [src('birthday', 1990, 12, 30, 'a'), src('birthday', 1926, 1, 2, 'b'), src('birthday', 1990, 3, 1, 'c')],
      today,
      7,
    );
    expect(list.map((x) => [x.refId, x.daysUntil, x.years, x.isJubilee])).toEqual([
      ['a', 2, 36, false],
      ['b', 5, 101, false],
    ]);
  });

  it('includes today and flags jubilees', () => {
    const [x] = upcomingAnniversaries([src('death_anniversary', 2016, 12, 28)], today, 0);
    expect(x).toMatchObject({ daysUntil: 0, years: 10, isJubilee: true });
  });

  it('moves Feb 29 to Feb 28 in non-leap years', () => {
    const [x] = upcomingAnniversaries([src('birthday', 2000, 2, 29)], { year: 2027, month: 2, day: 27 }, 3);
    expect(x.on).toEqual({ year: 2027, month: 2, day: 28 });
  });

  it('builds sources only from exact month/day dates and active marriages', () => {
    const g = sampleFamily().graph;
    g.persons[0].birthDate = { year: 1930, month: 5, day: 1, qualifier: 'exact' };
    g.persons[1].birthDate = { year: 1933, month: 5, day: 1, qualifier: 'about' };
    g.partnerships[0].startDate = { year: 1955, month: 7, day: 11, qualifier: 'exact' };
    const s = anniversarySources(g.persons, g.partnerships);
    expect(s.map((x) => `${x.kind}:${x.refId}`)).toEqual(['birthday:gf', 'wedding_anniversary:gf+gm']);
  });

  it('lists round anniversaries for a year', () => {
    const out = jubileesInYear([src('birthday', 1926, 1, 1), src('birthday', 1931, 1, 1)], 2026);
    expect(out.map((x) => x.years)).toEqual([100]);
  });
});
