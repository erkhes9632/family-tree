import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ArrowLeft } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';
import { GUIDES, listContent, loadContent } from '../../../../../../../content';

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => GUIDES.map((slug) => ({ locale, slug })));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const { locale, slug } = await params;
  const mod = await loadContent('guide', slug, locale);
  return mod ? { title: mod.meta.title, description: mod.meta.description } : {};
}

export default async function Page({ params }: { params: Promise<{ locale: 'mn' | 'en'; slug: string }> }) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const loader = loadContent('guide', slug, locale);
  if (!loader) notFound();
  const [mod, others, t] = await Promise.all([loader, listContent('guide', locale), getTranslations('culture')]);
  const Body = mod.default;
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 lg:grid-cols-[1fr_16rem]">
      <article>
        <Link href="/culture" className="mb-6 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" /> {t('back')}
        </Link>
        <h1 className="text-4xl font-semibold">{mod.meta.title}</h1>
        <p className="mt-2 text-lg text-muted-foreground">{mod.meta.description}</p>
        <div className="prose-content mt-6">
          <Body />
        </div>
      </article>
      <aside className="lg:pt-14">
        <p className="mb-2 text-sm font-semibold">{t('guideTitle')}</p>
        <ul className="space-y-1 text-sm">
          {others.map((o) => (
            <li key={o.slug}>
              <Link href={`/culture/guide/${o.slug}`} aria-current={o.slug === slug ? 'page' : undefined} className={o.slug === slug ? 'font-semibold text-primary' : 'text-muted-foreground hover:text-foreground'}>
                {o.meta.title}
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
