'use client';
import { useTranslations } from 'next-intl';
import { LogIn } from 'lucide-react';
import { Link, usePathname } from '@/i18n/navigation';
import { useAuthState } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { EmptyState, Spinner } from '@/components/ui/misc';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuthState();
  const t = useTranslations('auth');
  const pathname = usePathname();
  if (!isLoaded) {
    return (
      <div className="flex flex-1 items-center justify-center py-24">
        <Spinner />
      </div>
    );
  }
  if (!isSignedIn) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16">
        <EmptyState
          icon={<LogIn />}
          title={t('required')}
          description={t('requiredText')}
          action={
            <Button asChild>
              <Link href={{ pathname: '/sign-in', query: { redirect_url: pathname } }}>{t('signIn')}</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return <>{children}</>;
}
