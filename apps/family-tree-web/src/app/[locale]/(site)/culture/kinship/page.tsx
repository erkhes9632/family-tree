import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { KinshipBuilder } from '@/components/culture/kinship-builder';

export default async function KinshipHelperPage({ params }: { params: Promise<{ locale: 'mn' | 'en' }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('kinshipBuilder');
  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-2 text-4xl font-semibold">{t('title')}</h1>
      <p className="mb-8 text-muted-foreground">{t('intro')}</p>
      <KinshipBuilder />
      <p className="mt-8 text-sm text-muted-foreground">
        {t('ownTree')}{' '}
        <Link href="/dashboard" className="text-primary hover:underline">
          {t('ownTreeLink')}
        </Link>
      </p>
    </div>
  );
}
