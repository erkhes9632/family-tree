import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { CLANS, CLANS_BY_SLUG } from '@super-project/genealogy';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => CLANS.map((c) => ({ locale, slug: c.slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const c = CLANS_BY_SLUG.get(slug);
  if (!c) return {};
  return { title: locale === 'mn' ? c.nameMn : c.nameEn, description: locale === 'mn' ? c.summaryMn : c.summaryEn };
}

export default async function ClanPage({ params }: { params: Promise<{ locale: 'mn' | 'en'; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const c = CLANS_BY_SLUG.get(slug);
  if (!c) notFound();
  const t = await getTranslations('culture');
  const mn = locale === 'mn';
  const notable = mn ? c.notableMn : c.notableEn;
  return (
    <article className="mx-auto max-w-3xl px-4 py-10">
      <Link href="/culture/clans" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> {t('allClans')}
      </Link>
      <h1 className="text-4xl font-semibold">{mn ? c.nameMn : c.nameEn}</h1>
      <p className="mt-1 text-sm text-muted-foreground">{[mn ? c.nameEn : c.nameMn, ...c.altNames].join(' · ')}</p>
      <p className="mt-6 text-lg">{mn ? c.summaryMn : c.summaryEn}</p>
      <div className="prose-content mt-6">
        <h2>{t('history')}</h2>
        <p>{mn ? c.historyMn : c.historyEn}</p>
        {notable.length > 0 && (
          <>
            <h2>{t('notable')}</h2>
            <ul>
              {notable.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </>
        )}
        <blockquote>{t('clanNote')}</blockquote>
      </div>
    </article>
  );
}
