'use client';
import { useTranslations } from 'next-intl';
import { TreePine } from 'lucide-react';
import { RequireAuth } from '@/components/auth/require-auth';
import { CreateTreeDialog } from '@/components/dashboard/create-tree-dialog';
import { TreeCard } from '@/components/dashboard/tree-card';
import { UpcomingList } from '@/components/dashboard/upcoming-list';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { useMyTrees, useUpcoming } from '@/lib/queries';

export default function DashboardPage() {
  return (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  );
}

function Dashboard() {
  const t = useTranslations('dashboard');
  const trees = useMyTrees();
  const upcoming = useUpcoming(30);
  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-4 py-8 lg:grid-cols-[1fr_22rem]">
      <section aria-labelledby="my-trees">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h1 id="my-trees" className="text-3xl font-semibold">
            {t('title')}
          </h1>
          <CreateTreeDialog />
        </div>
        {trees.isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Skeleton className="h-36" />
            <Skeleton className="h-36" />
          </div>
        ) : trees.isError ? (
          <EmptyState title={t('loadError')} />
        ) : trees.data?.length ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {trees.data.map((tree) => (
              <TreeCard key={tree.id} tree={tree} role={tree.role} />
            ))}
          </div>
        ) : (
          <EmptyState icon={<TreePine />} title={t('empty')} description={t('emptyText')} action={<CreateTreeDialog />} />
        )}
      </section>
      <aside aria-labelledby="upcoming">
        <h2 id="upcoming" className="mb-4 text-xl font-semibold">
          {t('upcoming')}
        </h2>
        <UpcomingList items={upcoming.data} loading={upcoming.isLoading} />
      </aside>
    </div>
  );
}
