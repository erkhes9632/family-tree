'use client';
import { useTranslations } from 'next-intl';
import { Compass } from 'lucide-react';
import { usePublicTrees } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { TreeCard } from '@/components/dashboard/tree-card';

export default function ExplorePage() {
  const t = useTranslations('explore');
  const q = usePublicTrees();
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 text-3xl font-semibold">{t('title')}</h1>
      <p className="mb-6 max-w-2xl text-muted-foreground">{t('text')}</p>
      {q.isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
          <Skeleton className="h-36" />
        </div>
      ) : items.length ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((tree) => (
              <TreeCard key={tree.id} tree={tree} />
            ))}
          </div>
          {q.hasNextPage && (
            <div className="mt-6 flex justify-center">
              <Button variant="outline" onClick={() => q.fetchNextPage()} disabled={q.isFetchingNextPage}>
                {t('more')}
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState icon={<Compass />} title={t('empty')} />
      )}
    </div>
  );
}
