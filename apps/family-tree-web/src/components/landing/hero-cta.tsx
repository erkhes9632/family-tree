'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useAuthState } from '@/lib/auth';
import { Button } from '@/components/ui/button';

export function HeroCta() {
  const t = useTranslations('landing');
  const { isSignedIn } = useAuthState();
  return (
    <div className="flex flex-wrap gap-3">
      <Button asChild size="lg">
        <Link href={isSignedIn ? '/dashboard' : '/sign-up'}>{isSignedIn ? t('ctaDashboard') : t('ctaStart')}</Link>
      </Button>
      <Button asChild size="lg" variant="outline">
        <Link href="/explore">{t('ctaExplore')}</Link>
      </Button>
    </div>
  );
}
