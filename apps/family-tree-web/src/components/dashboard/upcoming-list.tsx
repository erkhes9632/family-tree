'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Cake, Flower2, Heart, PartyPopper } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import type { UpcomingItem } from '@/lib/queries';
import { Badge } from '@/components/ui/badge';
import { EmptyState, Skeleton } from '@/components/ui/misc';

const ICONS = { birthday: Cake, death_anniversary: Flower2, wedding_anniversary: Heart } as const;

export function UpcomingList({ items, loading }: { items: UpcomingItem[] | undefined; loading?: boolean }) {
  const t = useTranslations('upcoming');
  const locale = useLocale();
  if (loading) return <Skeleton className="h-40" />;
  if (!items?.length) return <EmptyState title={t('empty')} description={t('emptyText')} className="py-8" />;
  return (
    <ul className="divide-y rounded-xl border bg-card">
      {items.map((i) => {
        const Icon = ICONS[i.kind];
        const kind = i.kind === 'birthday' && i.deceased ? 'birth_anniversary' : i.kind;
        const date = new Date(Date.UTC(i.on.year, i.on.month - 1, i.on.day)).toLocaleDateString(locale === 'mn' ? 'mn-MN' : 'en-GB', { month: 'short', day: 'numeric', timeZone: 'UTC' });
        return (
          <li key={`${i.treeId}-${i.kind}-${i.refId}`} className="flex items-start gap-3 p-3">
            <span className="mt-0.5 rounded-full bg-accent p-2">
              <Icon className="size-4 text-primary" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{i.names.join(' & ')}</p>
              <p className="text-sm text-muted-foreground">
                {t(`kind.${kind}`, { years: i.years ?? 0, hasYears: i.years ? 'yes' : 'no' })} ·{' '}
                <Link href={`/trees/${i.treeId}/timeline`} className="hover:underline">
                  {i.treeName}
                </Link>
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1 text-right">
              <span className="text-sm font-medium">{i.daysUntil === 0 ? t('today') : i.daysUntil === 1 ? t('tomorrow') : t('inDays', { n: i.daysUntil })}</span>
              <span className="text-xs text-muted-foreground">{date}</span>
              {i.isJubilee && (
                <Badge variant="gold">
                  <PartyPopper /> {t('jubilee')}
                </Badge>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
