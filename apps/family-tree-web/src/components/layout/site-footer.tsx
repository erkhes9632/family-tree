import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { LogoMark } from './logo';

export function SiteFooter() {
  const t = useTranslations('footer');
  const tc = useTranslations('common');
  return (
    <footer className="mt-16 border-t bg-card/50">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2 font-serif text-lg font-semibold">
            <LogoMark className="size-6" /> {tc('appName')}
          </div>
          <p className="text-sm text-muted-foreground">{t('about')}</p>
        </div>
        <FooterCol title={t('product')} links={[{ href: '/dashboard', label: t('myTrees') }, { href: '/explore', label: t('explore') }, { href: '/settings', label: t('notifications') }]} />
        <FooterCol title={t('culture')} links={[{ href: '/culture/clans', label: t('clans') }, { href: '/culture/customs/tsagaan-sar', label: t('customs') }, { href: '/culture/guide/nine-generations', label: t('nineGenerations') }, { href: '/culture/kinship', label: t('kinship') }]} />
        <div className="space-y-2 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{t('privacyTitle')}</p>
          <p>{t('privacyText')}</p>
        </div>
      </div>
      <p className="pb-8 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} {tc('appName')}</p>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <div className="space-y-2 text-sm">
      <p className="font-medium">{title}</p>
      <ul className="space-y-1.5">
        {links.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="text-muted-foreground hover:text-foreground">
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
