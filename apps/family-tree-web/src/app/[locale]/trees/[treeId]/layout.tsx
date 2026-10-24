'use client';
import { use } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Clock, Images, Lock, Network, Settings, Sparkles, Users } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { ApiError, useApi } from '@/lib/api';
import { useAuthState } from '@/lib/auth';
import { qk, useInvalidatingMutation, useTree } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState, Spinner } from '@/components/ui/misc';
import { TreeProvider } from '@/components/tree/tree-context';
import { PRIVACY_ICONS } from '@/components/dashboard/create-tree-dialog';

export default function TreeLayout({ children, params }: { children: React.ReactNode; params: Promise<{ treeId: string }> }) {
  const { treeId } = use(params);
  const tree = useTree(treeId);
  const t = useTranslations('treeNav');
  const tp = useTranslations('privacy');
  const pathname = usePathname();

  if (tree.isLoading || !tree.data) {
    if (tree.error) return <TreeError error={tree.error} treeId={treeId} />;
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }
  const data = tree.data;
  const base = `/trees/${treeId}`;
  const tabs = [
    { href: base, label: t('tree'), icon: Network, exact: true },
    { href: `${base}/media`, label: t('media'), icon: Images },
    { href: `${base}/timeline`, label: t('timeline'), icon: Clock },
    { href: `${base}/kinship`, label: t('kinship'), icon: Sparkles },
    ...(data.access.role ? [{ href: `${base}/settings`, label: data.access.canManage ? t('settings') : t('members'), icon: data.access.canManage ? Settings : Users }] : []),
  ];
  const PrivacyIcon = PRIVACY_ICONS[data.privacy];
  const isCanvas = pathname === base;

  return (
    <TreeProvider tree={data}>
      <div className={cn('flex flex-1 flex-col', isCanvas && 'h-[calc(100dvh-3.5rem)] overflow-hidden')}>
        <div className="border-b bg-card/60">
          <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-2">
            <h1 className="min-w-0 truncate font-serif text-lg font-semibold">{data.name}</h1>
            <Badge variant="outline" className="gap-1">
              <PrivacyIcon className="size-3" /> {tp(`${data.privacy}.label`)}
            </Badge>
            {!data.access.role && <Badge variant="secondary">{t('readOnly')}</Badge>}
          </div>
          <nav className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-2" aria-label={t('label')}>
            {tabs.map((tab) => {
              const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors',
                    active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
                  )}
                >
                  <tab.icon className="size-4" />
                  {tab.label}
                </Link>
              );
            })}
          </nav>
        </div>
        {children}
      </div>
    </TreeProvider>
  );
}

function TreeError({ error, treeId }: { error: Error; treeId: string }) {
  const t = useTranslations('treeAccess');
  const tc = useTranslations('common');
  const { isSignedIn } = useAuthState();
  const api = useApi();
  const request = useInvalidatingMutation(() => api.post(`/trees/${treeId}/friend-requests`), [qk.tree(treeId)]);
  const details = error instanceof ApiError ? (error.details as { privacy?: string; name?: string; friendStatus?: string | null } | undefined) : undefined;

  if (error instanceof ApiError && error.status === 404) return <EmptyState className="m-6" title={t('notFound')} />;
  if (error instanceof ApiError && error.status === 401) {
    return (
      <EmptyState
        className="m-6"
        icon={<Lock />}
        title={t('signInTitle')}
        description={t('signInText')}
        action={
          <Button asChild>
            <Link href={{ pathname: '/sign-in', query: { redirect_url: `/trees/${treeId}` } }}>{tc('signIn')}</Link>
          </Button>
        }
      />
    );
  }
  if (error instanceof ApiError && error.code === 'no_access') {
    const isFriendsTree = details?.privacy === 'friends';
    return (
      <EmptyState
        className="m-6"
        icon={<Lock />}
        title={details?.name ? t('privateNamed', { name: details.name }) : t('private')}
        description={isFriendsTree ? t('friendsText') : t('familyText')}
        action={
          isFriendsTree && isSignedIn ? (
            details?.friendStatus === 'pending' || request.isSuccess ? (
              <Badge variant="secondary">{t('requested')}</Badge>
            ) : (
              <Button
                onClick={async () => {
                  try {
                    await request.mutateAsync(undefined);
                    toast.success(t('requestSent'));
                  } catch {
                    toast.error(tc('error'));
                  }
                }}
              >
                {t('requestAccess')}
              </Button>
            )
          ) : undefined
        }
      />
    );
  }
  return <EmptyState className="m-6" title={tc('error')} />;
}
