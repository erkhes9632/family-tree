import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { Noto_Sans, Noto_Serif, Noto_Sans_Mongolian } from 'next/font/google';
import { ClerkProvider } from '@clerk/nextjs';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';
import { CLERK_ENABLED, SITE_URL } from '@/lib/config';
import { Providers } from '@/components/providers';
import { SiteHeader } from '@/components/layout/site-header';
import '../globals.css';

const sans = Noto_Sans({ subsets: ['latin', 'cyrillic'], variable: '--font-noto-sans', display: 'swap' });
const serif = Noto_Serif({ subsets: ['latin', 'cyrillic'], variable: '--font-noto-serif', display: 'swap' });
const mongol = Noto_Sans_Mongolian({ weight: '400', subsets: ['mongolian'], variable: '--font-noto-mongolian', display: 'swap', preload: false });

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale: hasLocale(routing.locales, locale) ? locale : 'mn', namespace: 'meta' });
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: t('title'), template: `%s · ${t('short')}` },
    description: t('description'),
    manifest: '/manifest.webmanifest',
    openGraph: { title: t('title'), description: t('description'), type: 'website', locale: locale === 'mn' ? 'mn_MN' : 'en_US' },
    alternates: { languages: { mn: '/', en: '/en' } },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf7f0' },
    { media: '(prefers-color-scheme: dark)', color: '#1d1916' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);

  const app = (
    <NextIntlClientProvider>
      <Providers>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-card focus:px-3 focus:py-2 focus:shadow">
          {locale === 'mn' ? 'Үндсэн агуулга руу шилжих' : 'Skip to content'}
        </a>
        <div className="flex min-h-dvh flex-col">
          <SiteHeader />
          <div id="main" className="flex flex-1 flex-col">
            {children}
          </div>
        </div>
      </Providers>
    </NextIntlClientProvider>
  );

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={`${sans.variable} ${serif.variable} ${mongol.variable}`}>
        {CLERK_ENABLED ? <ClerkProvider afterSignOutUrl={locale === 'mn' ? '/' : '/en'}>{app}</ClerkProvider> : app}
      </body>
    </html>
  );
}
