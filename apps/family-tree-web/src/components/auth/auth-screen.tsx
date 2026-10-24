'use client';
import { SignIn, SignUp } from '@clerk/nextjs';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';
import { CLERK_ENABLED, DEMO_USERS } from '@/lib/config';
import { devSignIn } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/** Safe in-app redirect target (relative paths only). */
export function useRedirectTarget(fallback = '/dashboard') {
  const sp = useSearchParams();
  const r = sp.get('redirect_url') ?? sp.get('next');
  return r && r.startsWith('/') && !r.startsWith('//') ? r : fallback;
}

export function AuthScreen({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const locale = useLocale();
  const target = useRedirectTarget();
  const prefix = locale === 'mn' ? '' : `/${locale}`;
  if (CLERK_ENABLED) {
    const common = { forceRedirectUrl: target.startsWith(prefix) ? target : `${prefix}${target}` };
    return (
      <div className="flex justify-center px-4 py-12">
        {mode === 'sign-in' ? (
          <SignIn path={`${prefix}/sign-in`} signUpUrl={`${prefix}/sign-up`} {...common} />
        ) : (
          <SignUp path={`${prefix}/sign-up`} signInUrl={`${prefix}/sign-in`} {...common} />
        )}
      </div>
    );
  }
  return <DevSignIn target={target} />;
}

function DevSignIn({ target }: { target: string }) {
  const t = useTranslations('auth');
  const router = useRouter();
  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" /> {t('devTitle')}
          </CardTitle>
          <CardDescription>{t('devDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-2">
          {DEMO_USERS.map((u) => (
            <Button
              key={u.id}
              variant="outline"
              className="h-auto justify-start py-3 text-left"
              onClick={() => {
                devSignIn(u.id);
                router.push(target);
              }}
            >
              <span className="flex flex-col items-start">
                <span className="font-medium">{t(`demo.${u.role}`)}</span>
                <span className="text-xs text-muted-foreground">{u.id}</span>
              </span>
            </Button>
          ))}
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const id = new FormData(e.currentTarget).get('id')?.toString().trim();
              if (id && /^[A-Za-z0-9_-]{1,64}$/.test(id)) {
                devSignIn(id);
                router.push(target);
              }
            }}
          >
            <input name="id" aria-label={t('customId')} placeholder={t('customId')} className="h-10 flex-1 rounded-md border bg-card px-3 text-sm" pattern="[A-Za-z0-9_\-]{1,64}" />
            <Button type="submit">{t('continue')}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
