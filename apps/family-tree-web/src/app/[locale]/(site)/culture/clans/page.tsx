import { getTranslations, setRequestLocale } from 'next-intl/server';
import { CLANS } from '@super-project/genealogy';
import { Link } from '@/i18n/navigation';

export default async function ClansPage({ params }: { params: Promise<{ locale: 'mn' | 'en' }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('culture');
  const sorted = [...CLANS].sort((a, b) => (locale === 'mn' ? a.nameMn.localeCompare(b.nameMn, 'mn') : a.nameEn.localeCompare(b.nameEn)));
  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="mb-3 text-4xl font-semibold">{t('clansTitle')}</h1>
      <p className="mb-8 max-w-3xl text-muted-foreground">{t('clansIntro')}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {sorted.map((c) => (
          <li key={c.slug}>
            <Link href={`/culture/clans/${c.slug}`} className="block h-full rounded-xl border bg-card p-5 hover:shadow-md">
              <p className="font-serif text-xl font-semibold">{locale === 'mn' ? c.nameMn : c.nameEn}</p>
              {c.altNames.length > 0 && <p className="text-xs text-muted-foreground">{c.altNames.join(', ')}</p>}
              <p className="mt-2 text-sm text-muted-foreground">{locale === 'mn' ? c.summaryMn : c.summaryEn}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
