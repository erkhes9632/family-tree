'use client';
import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, Sparkles } from 'lucide-react';
import { describeRelationship, FamilyIndex, generationDepth, lifeSpanLabel, type KinCategory } from '@super-project/genealogy';
import { Link } from '@/i18n/navigation';
import { useGraph } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTreeContext } from '@/components/tree/tree-context';

const ORDER: KinCategory[] = ['partner', 'blood', 'in-law', 'step', 'relative'];

export default function KinshipPage() {
  const tree = useTreeContext();
  const t = useTranslations('kinship');
  const locale = useLocale();
  const graph = useGraph(tree.id);
  const index = React.useMemo(() => (graph.data ? new FamilyIndex(graph.data) : null), [graph.data]);
  const people = React.useMemo(() => [...(graph.data?.persons ?? [])].sort((a, b) => a.givenName.localeCompare(b.givenName, 'mn')), [graph.data]);
  const [from, setFrom] = React.useState<string | null>(null);
  const [to, setTo] = React.useState<string | null>(null);
  const fromId = from ?? tree.access.personId ?? tree.rootPersonId ?? people[0]?.id ?? null;

  const all = React.useMemo(() => {
    if (!index || !fromId) return [];
    return people
      .filter((p) => p.id !== fromId)
      .map((p) => ({ person: p, kin: describeRelationship(index, fromId, p.id) }))
      .filter((x) => x.kin.category !== 'none');
  }, [index, fromId, people]);

  if (graph.isLoading || !index) return <Skeleton className="m-6 h-96" />;
  if (!people.length) return <EmptyState className="m-6" title={t('empty')} />;
  const result = fromId && to ? describeRelationship(index, fromId, to) : null;
  const name = (id: string | null) => (id ? index.get(id)?.givenName : '') ?? '';
  const select = (value: string | null, onChange: (v: string) => void, id: string, label: string) => (
    <div className="grid flex-1 gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value ?? undefined} onValueChange={onChange}>
        <SelectTrigger id={id}>
          <SelectValue placeholder={t('choose')} />
        </SelectTrigger>
        <SelectContent>
          {people.map((p) => (
            <SelectItem key={p.id} value={p.id}>
              {p.givenName} {p.patronymic ? `(${p.patronymic})` : ''} {lifeSpanLabel(p.birthDate, p.deathDate, p.isLiving)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <main className="mx-auto w-full max-w-5xl space-y-8 px-4 py-6">
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="mb-1 flex items-center gap-2 text-2xl font-semibold">
          <Sparkles className="size-5 text-gold" /> {t('heading')}
        </h2>
        <p className="mb-5 text-sm text-muted-foreground">{t('intro')}</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          {select(fromId, setFrom, 'kin-from', t('from'))}
          <ArrowRight className="mx-auto hidden size-5 shrink-0 text-muted-foreground sm:mb-2.5 sm:block" />
          {select(to, setTo, 'kin-to', t('to'))}
        </div>
        {result && (
          <div className="mt-5 rounded-xl bg-accent/50 p-5 text-center" aria-live="polite">
            <p className="text-sm text-muted-foreground">{t('calls', { from: name(fromId), to: name(to) })}</p>
            <p className="mt-1 font-serif text-3xl font-semibold">{locale === 'mn' ? result.mn : result.en}</p>
            <p className="text-sm text-muted-foreground">{locale === 'mn' ? result.en : result.mn}</p>
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          {t('note')}{' '}
          <Link href="/culture/guide/kinship-terms" className="text-primary hover:underline">
            {t('guideLink')}
          </Link>
        </p>
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-xl font-semibold">{t('allOf', { name: name(fromId) })}</h2>
          <p className="text-sm text-muted-foreground">{t('generations', { n: generationDepth(index) })}</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {ORDER.map((cat) => {
            const list = all.filter((x) => x.kin.category === cat);
            if (!list.length) return null;
            return (
              <div key={cat} className="rounded-xl border bg-card">
                <h3 className="border-b px-4 py-2 font-sans text-sm font-semibold">{t(`category.${cat}`)}</h3>
                <ul className="divide-y">
                  {list.map(({ person, kin }) => (
                    <li key={person.id} className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
                      <Button variant="link" className="h-auto p-0" onClick={() => setTo(person.id)}>
                        {person.givenName}
                      </Button>
                      <span className="text-right">
                        <span className="font-medium">{locale === 'mn' ? kin.mn : kin.en}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>
    </main>
  );
}
