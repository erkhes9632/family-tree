'use client';
import { useLocale, useTranslations } from 'next-intl';
import { History } from 'lucide-react';
import { useAudit } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/misc';

function short(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return s.length > 60 ? `${s.slice(0, 57)}…` : s;
  }
  const s = String(v);
  return s.length > 60 ? `${s.slice(0, 57)}…` : s;
}

/** Edit history for a tree, or for one entity in it. */
export function HistoryList({ treeId, entityId }: { treeId: string; entityId?: string }) {
  const t = useTranslations('history');
  const locale = useLocale();
  const q = useAudit(treeId, entityId);
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  if (q.isLoading) return <Skeleton className="h-40" />;
  if (!items.length) return <EmptyState icon={<History />} title={t('empty')} />;
  const fmt = new Intl.DateTimeFormat(locale === 'mn' ? 'mn-MN' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Ulaanbaatar' });
  return (
    <div className="space-y-3">
      <ol className="relative space-y-4 border-l pl-5">
        {items.map((e) => (
          <li key={e.id} className="relative">
            <span className="absolute top-1.5 -left-[1.6rem] size-2.5 rounded-full border-2 border-background bg-primary" aria-hidden />
            <p className="text-sm">
              <strong>{e.userName ?? t('someone')}</strong> {t(`action.${e.action}`)} {t(`entity.${e.entityType as 'person'}`)}
              {e.summary && <span className="text-muted-foreground"> · {e.summary}</span>}
            </p>
            <p className="text-xs text-muted-foreground">{fmt.format(e.createdAt)}</p>
            {e.action === 'update' && e.changes && (
              <ul className="mt-1 space-y-0.5 text-xs">
                {Object.entries(e.changes)
                  .slice(0, 8)
                  .map(([k, [a, b]]) => (
                    <li key={k} className="break-words">
                      <span className="font-medium">{k}</span>: <span className="text-muted-foreground line-through">{short(a)}</span> → {short(b)}
                    </li>
                  ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
      {q.hasNextPage && (
        <Button variant="outline" size="sm" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
          {t('more')}
        </Button>
      )}
    </div>
  );
}
