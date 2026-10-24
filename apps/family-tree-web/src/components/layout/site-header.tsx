'use client';
import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { UserButton } from '@clerk/nextjs';
import { BookOpen, Compass, Languages, LogOut, Menu, Monitor, Moon, Settings, Sun, TreePine, UserRound } from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useAuthState } from '@/lib/auth';
import { CLERK_ENABLED } from '@/lib/config';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LogoMark } from './logo';

export function SiteHeader() {
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const pathname = usePathname();
  const { isSignedIn } = useAuthState();
  const [open, setOpen] = React.useState(false);

  const links = [
    ...(isSignedIn ? [{ href: '/dashboard', label: t('myTrees'), icon: TreePine }] : []),
    { href: '/explore', label: t('explore'), icon: Compass },
    { href: '/culture', label: t('culture'), icon: BookOpen },
  ];

  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon-sm" className="md:hidden" aria-label={t('openMenu')}>
              <Menu />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" closeLabel={tc('close')}>
            <SheetTitle className="p-4">{tc('appName')}</SheetTitle>
            <nav className="flex flex-col gap-1 px-2">
              {links.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted">
                  <l.icon className="size-4 text-muted-foreground" />
                  {l.label}
                </Link>
              ))}
            </nav>
          </SheetContent>
        </Sheet>

        <Link href="/" className="flex items-center gap-2 font-serif text-lg font-semibold">
          <LogoMark className="size-7" />
          <span className="hidden sm:inline">{tc('appName')}</span>
        </Link>

        <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label={t('main')}>
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
                pathname.startsWith(l.href) && 'bg-muted text-foreground',
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <LocaleSwitcher />
          <ThemeToggle />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}

function LocaleSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('nav');
  const next = locale === 'mn' ? 'en' : 'mn';
  return (
    <Button variant="ghost" size="sm" aria-label={t('language')} onClick={() => router.replace(pathname, { locale: next })}>
      <Languages />
      <span className="uppercase">{next}</span>
    </Button>
  );
}

function ThemeToggle() {
  const { setTheme } = useTheme();
  const t = useTranslations('nav');
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('theme')}>
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => setTheme('light')}>
          <Sun /> {t('light')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme('dark')}>
          <Moon /> {t('dark')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setTheme('system')}>
          <Monitor /> {t('system')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const { isLoaded, isSignedIn, userId, signOut } = useAuthState();
  const t = useTranslations('nav');
  const tc = useTranslations('common');
  const router = useRouter();
  if (!isLoaded) return <div className="size-8" />;
  if (!isSignedIn) {
    return (
      <Button asChild size="sm" className="ml-1">
        <Link href="/sign-in">{tc('signIn')}</Link>
      </Button>
    );
  }
  if (CLERK_ENABLED) {
    return (
      <div className="ml-1 flex items-center gap-1">
        <Button asChild variant="ghost" size="icon-sm" aria-label={t('settings')}>
          <Link href="/settings">
            <Settings />
          </Link>
        </Button>
        <UserButton />
      </div>
    );
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon-sm" className="ml-1 rounded-full" aria-label={t('account')}>
          <UserRound />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="max-w-56 truncate">{userId}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push('/dashboard')}>
          <TreePine /> {t('myTrees')}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => router.push('/settings')}>
          <Settings /> {t('settings')}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={async () => {
            await signOut();
            router.push('/');
          }}
        >
          <LogOut /> {tc('signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
