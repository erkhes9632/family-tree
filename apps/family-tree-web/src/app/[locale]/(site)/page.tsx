import { useTranslations } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { use } from 'react';
import { BellRing, BookOpen, Images, Mic, Network, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import { HeroCta } from '@/components/landing/hero-cta';

export default function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  setRequestLocale(locale as 'mn' | 'en');
  const t = useTranslations('landing');

  const features = [
    { icon: Network, key: 'tree' },
    { icon: Images, key: 'archive' },
    { icon: Mic, key: 'stories' },
    { icon: BookOpen, key: 'culture' },
    { icon: BellRing, key: 'reminders' },
    { icon: ShieldCheck, key: 'privacy' },
  ] as const;

  const generations = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8', 'g9'] as const;

  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklch,var(--gold)_30%,transparent),transparent_60%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
          <div className="space-y-6">
            <p className="text-sm font-medium tracking-wide text-primary uppercase">{t('eyebrow')}</p>
            <h1 className="text-4xl leading-tight font-semibold text-balance sm:text-5xl">{t('title')}</h1>
            <p className="max-w-xl text-lg text-pretty text-muted-foreground">{t('subtitle')}</p>
            <HeroCta />
          </div>
          <HeroIllustration />
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-16">
        <h2 className="mb-8 text-3xl font-semibold">{t('featuresTitle')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ icon: Icon, key }) => (
            <div key={key} className="rounded-xl border bg-card p-5 shadow-sm">
              <Icon className="mb-3 size-6 text-primary" />
              <h3 className="mb-1 text-lg font-semibold">{t(`features.${key}.title`)}</h3>
              <p className="text-sm text-muted-foreground">{t(`features.${key}.text`)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y bg-card/60">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-16 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-3xl font-semibold">{t('nineTitle')}</h2>
            <p className="text-muted-foreground">{t('nineText')}</p>
            <Button asChild variant="outline">
              <Link href="/culture/guide/nine-generations">{t('nineCta')}</Link>
            </Button>
          </div>
          <ol className="grid grid-cols-3 gap-2 text-center" aria-label={t('nineTitle')}>
            {generations.map((g, i) => (
              <li key={g} className={`rounded-lg border p-3 ${i === 4 ? 'border-primary bg-primary text-primary-foreground' : 'bg-background'}`}>
                <span className="block text-xs opacity-70">{i < 4 ? `+${4 - i}` : i === 4 ? '0' : `−${i - 4}`}</span>
                <span className="font-serif font-semibold">{t(`generations.${g}`)}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-20 text-center">
        <blockquote className="font-serif text-2xl text-balance italic">“{t('proverb')}”</blockquote>
        <p className="mt-3 text-sm text-muted-foreground">{t('proverbNote')}</p>
      </section>
    </>
  );
}

function HeroIllustration() {
  // Decorative mini family tree
  const node = (x: number, y: number, kind: 'm' | 'f', key: string) => (
    <g key={key}>
      <rect x={x - 34} y={y - 16} width="68" height="32" rx="8" className={kind === 'm' ? 'fill-node-male stroke-blue/40' : 'fill-node-female stroke-primary/40'} strokeWidth="1.5" />
      <circle cx={x - 20} cy={y} r="8" className={kind === 'm' ? 'fill-blue/50' : 'fill-primary/50'} />
      <rect x={x - 8} y={y - 5} width="32" height="4" rx="2" className="fill-foreground/40" />
      <rect x={x - 8} y={y + 3} width="20" height="3" rx="1.5" className="fill-foreground/20" />
    </g>
  );
  return (
    <div aria-hidden className="rounded-2xl border bg-canvas p-4 shadow-lg">
      <svg viewBox="0 0 360 260" className="w-full">
        <g className="stroke-foreground/30" strokeWidth="1.5" fill="none">
          <path d="M110 46 V70 M190 46 V70 M110 70 H190 M150 70 V110 M150 110 H70 M150 110 H230 M70 110 V134 M230 110 V134 M230 166 V190 M300 150 V190 M230 190 H300 M265 190 V214" />
        </g>
        <circle cx="150" cy="70" r="4" className="fill-gold" />
        <circle cx="265" cy="190" r="4" className="fill-gold" />
        {node(110, 30, 'm', 'a')}
        {node(190, 30, 'f', 'b')}
        {node(70, 150, 'f', 'c')}
        {node(230, 150, 'm', 'd')}
        {node(300, 134, 'f', 'e')}
        {node(265, 230, 'm', 'f')}
      </svg>
    </div>
  );
}
