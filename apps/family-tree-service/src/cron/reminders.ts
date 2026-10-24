import { and, eq, isNull } from 'drizzle-orm';
import {
  anniversarySources,
  shortName,
  todayInTimeZone,
  upcomingAnniversaries,
  type AnniversarySource,
  type CalendarDay,
  type UpcomingAnniversary,
  isoDay,
} from '@super-project/genealogy';
import type { PersonSummary, ReminderKind } from '@super-project/types';
import { REMINDER_KINDS } from '@super-project/types';
import type { Bindings } from '../env';
import type { Database } from '../db';
import { notificationPrefs, partnerships, persons, remindersSent, treeMembers, trees, users } from '../db/schema';
import { emailLayout, escapeHtml, sendEmail } from '../lib/email';
import { toPartnershipDto, toPersonSummary } from '../lib/mappers';
import { pushConfigured, sendPushToUser } from '../lib/push';

export interface UpcomingItem extends UpcomingAnniversary {
  treeId: string;
  treeName: string;
  names: string[];
  /** any of the people involved has passed away */
  deceased: boolean;
}

interface TreeData {
  name: string;
  sources: AnniversarySource[];
  people: Map<string, PersonSummary>;
}

export async function loadTreeData(db: Database, treeId: string): Promise<TreeData | null> {
  const [t, ps, pts] = await db.batch([
    db.select({ name: trees.name }).from(trees).where(eq(trees.id, treeId)).limit(1),
    db.select().from(persons).where(eq(persons.treeId, treeId)),
    db.select().from(partnerships).where(eq(partnerships.treeId, treeId)),
  ]);
  if (!t[0]) return null;
  const summaries = ps.map((p) => toPersonSummary(p));
  return {
    name: t[0].name,
    sources: anniversarySources(summaries, pts.map(toPartnershipDto)),
    people: new Map(summaries.map((p) => [p.id, p])),
  };
}

/** Upcoming anniversaries across every tree the user belongs to. */
export async function upcomingForUser(
  db: Database,
  userId: string,
  today: CalendarDay,
  daysAhead: number,
  cache = new Map<string, TreeData | null>(),
): Promise<UpcomingItem[]> {
  const memberships = await db.select({ treeId: treeMembers.treeId }).from(treeMembers).where(eq(treeMembers.userId, userId));
  const out: UpcomingItem[] = [];
  for (const { treeId } of memberships) {
    if (!cache.has(treeId)) cache.set(treeId, await loadTreeData(db, treeId));
    const data = cache.get(treeId);
    if (!data) continue;
    for (const u of upcomingAnniversaries(data.sources, today, daysAhead)) {
      out.push({
        ...u,
        treeId,
        treeName: data.name,
        names: u.personIds.map((id) => {
          const p = data.people.get(id);
          return p ? shortName(p) : '?';
        }),
        deceased: u.personIds.some((id) => data.people.get(id)?.isLiving === false),
      });
    }
  }
  return out.sort((a, b) => a.daysUntil - b.daysUntil);
}

const LABELS: Record<ReminderKind | 'birth_anniversary', { mn: (y: number | null) => string; en: (y: number | null) => string }> = {
  birthday: {
    mn: (y) => (y ? `${y} насны төрсөн өдөр` : 'төрсөн өдөр'),
    en: (y) => (y ? `${ordinal(y)} birthday` : 'birthday'),
  },
  birth_anniversary: {
    mn: (y) => (y ? `мэндэлсний ${y} жилийн ой` : 'мэндэлсэн өдөр'),
    en: (y) => (y ? `${ordinal(y)} birth anniversary` : 'birth anniversary'),
  },
  death_anniversary: {
    mn: (y) => (y ? `таалал төгссөний ${y} жил` : 'дурсгалын өдөр'),
    en: (y) => (y ? `${ordinal(y)} death anniversary` : 'death anniversary'),
  },
  wedding_anniversary: {
    mn: (y) => (y ? `гэрлэсний ${y} жилийн ой` : 'гэрлэсэн ой'),
    en: (y) => (y ? `${ordinal(y)} wedding anniversary` : 'wedding anniversary'),
  },
};

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function describeItem(item: UpcomingItem, locale: 'mn' | 'en'): string {
  const who = item.names.join(locale === 'mn' ? ', ' : ' & ');
  const kind = item.kind === 'birthday' && item.deceased ? 'birth_anniversary' : item.kind;
  const what = LABELS[kind][locale](item.years);
  const jubilee = item.isJubilee ? (locale === 'mn' ? ' 🎉 ой' : ' 🎉 jubilee') : '';
  const when =
    item.daysUntil === 0
      ? locale === 'mn' ? 'өнөөдөр' : 'today'
      : item.daysUntil === 1
        ? locale === 'mn' ? 'маргааш' : 'tomorrow'
        : locale === 'mn' ? `${item.daysUntil} хоногийн дараа` : `in ${item.daysUntil} days`;
  return `${who} — ${what}${jubilee} (${when}, ${item.treeName})`;
}

export interface ReminderRunResult {
  usersChecked: number;
  emails: number;
  pushes: number;
}

/**
 * Hourly cron: for each user whose local time is REMINDER_LOCAL_HOUR, send reminders for
 * anniversaries happening today or exactly `daysBefore` days ahead. `reminders_sent` makes
 * this idempotent (retries and overlapping runs never double-send).
 */
export async function runReminders(env: Bindings, db: Database, now = new Date(), opts: { force?: boolean } = {}): Promise<ReminderRunResult> {
  const hour = Number(env.REMINDER_LOCAL_HOUR ?? '8');
  const rows = await db
    .selectDistinct({ user: users, prefs: notificationPrefs })
    .from(treeMembers)
    .innerJoin(users, eq(users.id, treeMembers.userId))
    .leftJoin(notificationPrefs, eq(notificationPrefs.userId, users.id))
    .where(isNull(users.deletedAt));

  const cache = new Map<string, TreeData | null>();
  const result: ReminderRunResult = { usersChecked: 0, emails: 0, pushes: 0 };

  for (const { user, prefs } of rows) {
    const p = prefs ?? { emailEnabled: true, pushEnabled: false, daysBefore: 1, kinds: [...REMINDER_KINDS], timezone: user.timezone };
    const local = todayInTimeZone(p.timezone || env.DEFAULT_TIMEZONE, now);
    if (!opts.force && local.hour !== hour) continue;
    result.usersChecked++;

    const items = (await upcomingForUser(db, user.id, local, p.daysBefore, cache)).filter(
      (i) => p.kinds.includes(i.kind) && (i.daysUntil === 0 || i.daysUntil === p.daysBefore),
    );
    if (!items.length) continue;

    const channels: ('email' | 'push')[] = [];
    if (p.emailEnabled && user.email) channels.push('email');
    if (p.pushEnabled && pushConfigured(env)) channels.push('push');

    for (const channel of channels) {
      const fresh: UpcomingItem[] = [];
      for (const item of items) {
        const inserted = await db
          .insert(remindersSent)
          .values({ userId: user.id, kind: item.kind, refId: item.refId, occurrence: isoDay(item.on), daysBefore: item.daysUntil, channel })
          .onConflictDoNothing()
          .returning({ id: remindersSent.id });
        if (inserted.length) fresh.push(item);
      }
      if (!fresh.length) continue;
      const locale = user.locale;
      const lines = fresh.map((i) => describeItem(i, locale));
      const origin = env.WEB_ORIGIN.split(',')[0];
      let ok = false;
      if (channel === 'email' && user.email) {
        const title = locale === 'mn' ? 'Ойртож буй ой, тэмдэглэлт өдрүүд' : 'Upcoming family anniversaries';
        const res = await sendEmail(env, {
          to: user.email,
          subject: title,
          text: lines.join('\n'),
          html: emailLayout(title, `<ul style="padding-left:18px">${lines.map((l) => `<li>${escapeHtml(l)}</li>`).join('')}</ul>`, {
            href: `${origin}/${locale === 'en' ? 'en/' : ''}dashboard`,
            label: locale === 'mn' ? 'Ургийн бичгээ нээх' : 'Open your family tree',
          }),
        });
        ok = res.ok;
        if (ok) result.emails++;
      } else if (channel === 'push') {
        const sent = await sendPushToUser(env, db, user.id, {
          title: locale === 'mn' ? 'Гэр бүлийн сануулга' : 'Family reminder',
          body: lines.slice(0, 3).join('\n'),
          url: `/${locale === 'en' ? 'en/' : ''}trees/${fresh[0].treeId}/timeline`,
          tag: `reminder-${isoDay(local)}`,
        });
        ok = sent > 0;
        if (ok) result.pushes++;
      }
      if (!ok) {
        // allow a retry on the next run
        for (const item of fresh) {
          await db
            .delete(remindersSent)
            .where(
              and(
                eq(remindersSent.userId, user.id),
                eq(remindersSent.refId, item.refId),
                eq(remindersSent.occurrence, isoDay(item.on)),
                eq(remindersSent.channel, channel),
                eq(remindersSent.daysBefore, item.daysUntil),
              ),
            );
        }
      }
    }
  }
  return result;
}
