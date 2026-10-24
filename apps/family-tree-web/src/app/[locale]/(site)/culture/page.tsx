import { getTranslations, setRequestLocale } from 'next-intl/server';
import { BookOpen, Castle, Sparkles, Users } from 'lucide-react';
import { CLANS } from '@super-project/genealogy';
import { Link } from '@/i18n/navigation';
import { listContent } from '../../../../../content';

export default async function CulturePage({ params }: { params: Promise<{ locale: 'mn' | 'en' }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('culture');
  const [customs, guides] = await Promise.all([listContent('customs', locale), listContent('guide', locale)]);
  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <header className="mb-10 max-w-3xl space-y-3">
        <p className="text-sm font-medium tracking-wide text-primary uppercase">{t('eyebrow')}</p>
        <h1 className="text-4xl font-semibold">{t('title')}</h1>
        <p className="text-lg text-muted-foreground">{t('intro')}</p>
      </header>

      <div className="grid gap-10 lg:grid-cols-2">
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-semibold">
            <Users className="size-5 text-primary" /> {t('guideTitle')}
          </h2>
          <ul className="space-y-3">
            {guides.map((g) => (
              <li key={g.slug}>
                <Link href={`/culture/guide/${g.slug}`} className="block rounded-xl border bg-card p-4 hover:shadow-md">
                  <p className="font-semibold">{g.meta.title}</p>
                  <p className="text-sm text-muted-foreground">{g.meta.description}</p>
                </Link>
              </li>
            ))}
            <li>
              <Link href="/culture/kinship" className="flex items-center gap-3 rounded-xl border border-gold bg-accent/40 p-4 hover:shadow-md">
                <Sparkles className="size-6 shrink-0 text-gold" />
                <span>
                  <span className="block font-semibold">{t('kinshipTitle')}</span>
                  <span className="text-sm text-muted-foreground">{t('kinshipText')}</span>
                </span>
              </Link>
            </li>
          </ul>
        </section>
        <section>
          <h2 className="mb-4 flex items-center gap-2 text-2xl font-semibold">
            <BookOpen className="size-5 text-primary" /> {t('customsTitle')}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {customs.map((c) => (
              <li key={c.slug}>
                <Link href={`/culture/customs/${c.slug}`} className="block h-full rounded-xl border bg-card p-4 hover:shadow-md">
                  <p className="font-semibold">{c.meta.title}</p>
                  <p className="text-sm text-muted-foreground">{c.meta.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="mt-12">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Castle className="size-5 text-primary" /> {t('clansTitle')}
          </h2>
          <Link href="/culture/clans" className="text-sm text-primary hover:underline">
            {t('allClans')}
          </Link>
        </div>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {CLANS.slice(0, 8).map((c) => (
            <li key={c.slug}>
              <Link href={`/culture/clans/${c.slug}`} className="block h-full rounded-xl border bg-card p-4 hover:shadow-md">
                <p className="font-serif text-lg font-semibold">{locale === 'mn' ? c.nameMn : c.nameEn}</p>
                <p className="line-clamp-3 text-sm text-muted-foreground">{locale === 'mn' ? c.summaryMn : c.summaryEn}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
