'use client';
import { use } from 'react';
import { useTranslations } from 'next-intl';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { MailOpen } from 'lucide-react';
import type { InvitationPreview } from '@super-project/types';
import { Link, useRouter } from '@/i18n/navigation';
import { ApiError, useApi } from '@/lib/api';
import { useAuthState } from '@/lib/auth';
import { qk, useInvalidatingMutation } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState, Spinner } from '@/components/ui/misc';

export default function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const t = useTranslations('invitePage');
  const tr = useTranslations('roles');
  const tc = useTranslations('common');
  const api = useApi();
  const router = useRouter();
  const { isLoaded, isSignedIn } = useAuthState();
  const preview = useQuery({ queryKey: ['invite', token], queryFn: () => api.get<InvitationPreview>(`/invitations/${token}`), enabled: isLoaded });
  const accept = useInvalidatingMutation(() => api.post<{ treeId: string }>(`/invitations/${token}/accept`, {}), [qk.trees, qk.me]);

  if (!preview.data) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }
  const p = preview.data;
  if (!p.valid) return <EmptyState className="mx-auto my-16 max-w-md" title={t('invalid')} description={t(`reason.${p.reason ?? 'not_found'}`)} />;

  return (
    <div className="mx-auto w-full max-w-md px-4 py-16">
      <Card>
        <CardHeader className="items-center text-center">
          <MailOpen className="mb-2 size-10 text-primary" />
          <CardTitle>{t('title', { tree: p.treeName })}</CardTitle>
          <CardDescription>{t('from', { name: p.inviterName ?? t('relative'), role: tr(p.role) })}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          {p.personName && <p className="rounded-lg bg-accent/50 p-3 text-sm">{t('linkedAs', { name: p.personName })}</p>}
          {isSignedIn ? (
            <Button
              size="lg"
              className="w-full"
              disabled={accept.isPending}
              onClick={async () => {
                try {
                  const res = await accept.mutateAsync(undefined);
                  toast.success(t('joined'));
                  router.push(`/trees/${res.treeId}`);
                } catch (err) {
                  toast.error(err instanceof ApiError ? err.message : tc('error'));
                }
              }}
            >
              {t('accept')}
            </Button>
          ) : (
            <div className="grid gap-2">
              <p className="text-sm text-muted-foreground">{t('signInFirst')}</p>
              <Button asChild size="lg">
                <Link href={{ pathname: '/sign-up', query: { redirect_url: `/invite/${token}` } }}>{tc('signUp')}</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={{ pathname: '/sign-in', query: { redirect_url: `/invite/${token}` } }}>{tc('signIn')}</Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
