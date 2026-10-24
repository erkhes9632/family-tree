'use client';
import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Award, Baby, Flower2, GraduationCap, Heart, HeartCrack, MapPin, PartyPopper, Shield, Sparkles, Star } from 'lucide-react';
import { comparePartialDates, formatPartialDate, hasYear, jubileesInYear, type AnniversarySource } from '@super-project/genealogy';
import type { EventType, PersonSummary, TimelineEntry } from '@super-project/types';
import { EVENT_TYPES } from '@super-project/types';
import { Link } from '@/i18n/navigation';
import { useGraph, useTimeline } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { useTreeContext } from '@/components/tree/tree-context';

const ICONS: Record<EventType, React.ComponentType<{ className?: string }>> = {
  birth: Baby,
  death: Flower2,
  marriage: Heart,
  divorce: HeartCrack,
  graduation: GraduationCap,
  migration: MapPin,
  military: Shield,
  award: Award,
  custom: Star,
};

export default function TimelinePage() {
  const tree = useTreeContext();
  const t = useTranslations('timeline');
  const te = useTranslations('eventType');
  const locale = useLocale();
  const timeline = useTimeline(tree.id);
  const graph = useGraph(tree.id);
  const [types, setTypes] = React.useState<Set<EventType>>(() => new Set(EVENT_TYPES));
  const thisYear = new Date().getFullYear();
  const persons = React.useMemo(() => new Map((graph.data?.persons ?? []).map((p) => [p.id, p])), [graph.data]);

  const entries = React.useMemo(
    () => (timeline.data ?? []).filter((e) => types.has(e.type) && hasYear(e.date)).sort((a, b) => comparePartialDates(a.date, b.date)),
    [timeline.data, types],
  );

  const jubilees = React.useMemo(() => {
    // a marriage that ended in divorce has no anniversaries to celebrate
    const divorced = new Set((timeline.data ?? []).filter((e) => e.type === 'divorce').map((e) => e.key.slice(2)));
    const sources: AnniversarySource[] = (timeline.data ?? [])
      .filter((e) => (e.type === 'birth' || e.type === 'death' || e.type === 'marriage') && hasYear(e.date))
      .filter((e) => !(e.type === 'marriage' && divorced.has(e.key.slice(2))))
      .map((e) => ({
        kind: e.type === 'birth' ? 'birthday' : e.type === 'death' ? 'death_anniversary' : 'wedding_anniversary',
        refId: e.key,
        personIds: e.personIds,
        date: e.date,
      }));
    return [thisYear, thisYear + 1].flatMap((y) =>
      jubileesInYear(sources, y).map((j) => ({ ...j, year: y })),
    );
  }, [timeline.data, thisYear]);

  const byDecade = React.useMemo(() => {
    const groups = new Map<number, TimelineEntry[]>();
    for (const e of entries) {
      const decade = Math.floor((e.date.year as number) / 10) * 10;
      groups.set(decade, [...(groups.get(decade) ?? []), e]);
    }
    return [...groups.entries()];
  }, [entries]);

  if (timeline.isLoading) return <Skeleton className="m-6 h-96" />;

  return (
    <main className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-6 lg:grid-cols-[1fr_18rem]">
      <section aria-labelledby="tl-h">
        <h2 id="tl-h" className="mb-4 text-2xl font-semibold">
          {t('heading')}
        </h2>
        <div className="mb-6 flex flex-wrap gap-1.5" role="group" aria-label={t('filter')}>
          {EVENT_TYPES.map((ty) => {
            const on = types.has(ty);
            const Icon = ICONS[ty];
            return (
              <Button
                key={ty}
                size="sm"
                variant={on ? 'secondary' : 'outline'}
                aria-pressed={on}
                className={cn(!on && 'opacity-60')}
                onClick={() =>
                  setTypes((prev) => {
                    const next = new Set(prev);
                    if (next.has(ty)) next.delete(ty);
                    else next.add(ty);
                    return next;
                  })
                }
              >
                <Icon /> {te(ty)}
              </Button>
            );
          })}
        </div>
        {!entries.length ? (
          <EmptyState title={t('empty')} description={t('emptyText')} />
        ) : (
          <div className="space-y-8">
            {byDecade.map(([decade, list]) => (
              <section key={decade} aria-label={t('decade', { decade })}>
                <h3 className="sticky top-14 z-10 -mx-1 mb-3 bg-background/90 px-1 py-1 font-serif text-xl font-semibold text-primary backdrop-blur">{t('decade', { decade })}</h3>
                <ol className="relative space-y-3 border-l-2 border-border pl-6">
                  {list.map((e) => (
                    <TimelineRow key={e.key} entry={e} persons={persons} treeId={tree.id} locale={locale === 'mn' ? 'mn' : 'en'} thisYear={thisYear} />
                  ))}
                </ol>
              </section>
            ))}
          </div>
        )}
      </section>
      <aside aria-labelledby="jub-h" className="space-y-3">
        <h2 id="jub-h" className="flex items-center gap-2 text-xl font-semibold">
          <Sparkles className="size-5 text-gold" /> {t('jubilees')}
        </h2>
        <p className="text-sm text-muted-foreground">{t('jubileesText')}</p>
        {jubilees.length ? (
          <ul className="space-y-2">
            {jubilees.map((j) => {
              const names = j.personIds.map((id) => persons.get(id)?.givenName ?? '?').join(' & ');
              const deceased = j.personIds.some((id) => persons.get(id)?.isLiving === false);
              const kind = j.kind === 'birthday' && deceased ? 'birth_anniversary' : j.kind;
              return (
                <li key={`${j.refId}-${j.year}`} className="rounded-lg border bg-card p-3">
                  <p className="text-sm font-medium">{names}</p>
                  <p className="text-sm text-muted-foreground">{t(`jubilee.${kind}`, { years: j.years, year: j.year })}</p>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t('noJubilees')}</p>
        )}
      </aside>
    </main>
  );
}

function TimelineRow({ entry: e, persons, treeId, locale, thisYear }: { entry: TimelineEntry; persons: Map<string, PersonSummary>; treeId: string; locale: 'mn' | 'en'; thisYear: number }) {
  const t = useTranslations('timeline');
  const te = useTranslations('eventType');
  const Icon = ICONS[e.type];
  const ago = thisYear - (e.date.year as number);
  const round = ago > 0 && ago % 10 === 0 && (e.type === 'birth' || e.type === 'marriage' || e.type === 'death');
  const people = e.personIds.map((id) => persons.get(id)).filter((p): p is PersonSummary => !!p);
  return (
    <li className="relative">
      <span className={cn('absolute top-2 -left-[2.1rem] flex size-6 items-center justify-center rounded-full border-2 border-background', round ? 'bg-gold text-foreground' : 'bg-primary text-primary-foreground')} aria-hidden>
        <Icon className="size-3.5" />
      </span>
      <div className={cn('rounded-lg border bg-card px-4 py-3', round && 'border-gold ring-1 ring-gold/50')}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-medium">
            {e.title ?? te(e.type)}
            {people.length > 0 && ': '}
            {people.map((p, i) => (
              <React.Fragment key={p.id}>
                {i > 0 && ' & '}
                <Link href={`/trees/${treeId}/people/${p.id}`} className="text-primary hover:underline">
                  {p.givenName}
                </Link>
              </React.Fragment>
            ))}
          </p>
          <span className="text-sm text-muted-foreground tabular-nums">{formatPartialDate(e.date, locale)}</span>
        </div>
        {e.description && <p className="mt-1 text-sm text-muted-foreground">{e.description}</p>}
        {round && (
          <Badge variant="gold" className="mt-2">
            <PartyPopper /> {t('roundThisYear', { years: ago })}
          </Badge>
        )}
      </div>
    </li>
  );
}
