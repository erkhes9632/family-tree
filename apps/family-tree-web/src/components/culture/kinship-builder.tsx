'use client';
import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { ChevronRight, RotateCcw, Undo2 } from 'lucide-react';
import { describeRelationship, FamilyIndex } from '@super-project/genealogy';
import type { Gender, PersonSummary, TreeGraph } from '@super-project/types';
import { Button } from '@/components/ui/button';

export type Step = 'father' | 'mother' | 'olderBrother' | 'youngerBrother' | 'olderSister' | 'youngerSister' | 'son' | 'daughter' | 'husband' | 'wife';
const STEPS: Step[] = ['father', 'mother', 'olderBrother', 'youngerBrother', 'olderSister', 'youngerSister', 'son', 'daughter', 'husband', 'wife'];

/** Build a tiny synthetic tree from a chain of steps and describe the last person relative to "me". */
export function describeChain(me: Gender, steps: Step[]) {
  const g: TreeGraph = { persons: [], parentChild: [], partnerships: [] };
  const years = new Map<string, number>();
  const add = (id: string, gender: Gender, year: number) => {
    years.set(id, year);
    const p: PersonSummary = { id, givenName: id, patronymic: null, clanName: null, gender, isLiving: true, birthDate: { year, qualifier: 'exact' }, deathDate: null, photoUrl: null, userId: null, redacted: false };
    g.persons.push(p);
  };
  const parentOf = new Map<string, string>();
  const link = (parent: string, child: string) => {
    g.parentChild.push({ id: `${parent}>${child}`, parentId: parent, childId: child, type: 'biological' });
    if (!parentOf.has(child)) parentOf.set(child, parent);
  };
  add('me', me, 2000);
  let cur = 'me';
  steps.forEach((s, i) => {
    const id = `p${i}`;
    const y = years.get(cur) as number;
    const male = ['father', 'olderBrother', 'youngerBrother', 'son', 'husband'].includes(s);
    if (s === 'father' || s === 'mother') {
      add(id, male ? 'male' : 'female', y - 28);
      link(id, cur);
    } else if (s === 'son' || s === 'daughter') {
      add(id, male ? 'male' : 'female', y + 28);
      link(cur, id);
    } else if (s === 'husband' || s === 'wife') {
      add(id, male ? 'male' : 'female', y);
      g.partnerships.push({ id: `${cur}+${id}`, person1Id: cur, person2Id: id, status: 'married', startDate: null, endDate: null, sortOrder: 0, notes: null });
    } else {
      let parent = parentOf.get(cur);
      if (!parent) {
        parent = `pp${i}`;
        add(parent, 'unknown', y - 28);
        link(parent, cur);
      }
      add(id, male ? 'male' : 'female', s.startsWith('older') ? y - 4 : y + 4);
      link(parent, id);
    }
    cur = id;
  });
  return describeRelationship(new FamilyIndex(g), 'me', cur);
}

export function KinshipBuilder() {
  const t = useTranslations('kinshipBuilder');
  const locale = useLocale();
  const [me, setMe] = React.useState<Gender>('male');
  const [steps, setSteps] = React.useState<Step[]>([]);
  const result = steps.length ? describeChain(me, steps) : null;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t('iAm')}</span>
        {(['male', 'female'] as const).map((g) => (
          <Button key={g} size="sm" variant={me === g ? 'default' : 'outline'} aria-pressed={me === g} onClick={() => setMe(g)}>
            {t(`me.${g}`)}
          </Button>
        ))}
      </div>
      <div className="rounded-xl border bg-card p-4">
        <p className="mb-2 text-sm text-muted-foreground">{t('chain')}</p>
        <ol className="flex min-h-10 flex-wrap items-center gap-1 text-sm" aria-live="polite">
          <li className="rounded-full bg-primary px-3 py-1 text-primary-foreground">{t('meLabel')}</li>
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
              <li className="rounded-full bg-secondary px-3 py-1">{t(`steps.${s}`)}</li>
            </React.Fragment>
          ))}
        </ol>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {STEPS.map((s) => (
          <Button key={s} variant="outline" disabled={steps.length >= 6} onClick={() => setSteps([...steps, s])}>
            + {t(`steps.${s}`)}
          </Button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="ghost" size="sm" disabled={!steps.length} onClick={() => setSteps(steps.slice(0, -1))}>
          <Undo2 /> {t('undo')}
        </Button>
        <Button variant="ghost" size="sm" disabled={!steps.length} onClick={() => setSteps([])}>
          <RotateCcw /> {t('reset')}
        </Button>
      </div>
      {result && (
        <div className="rounded-2xl border-2 border-gold bg-accent/40 p-6 text-center">
          <p className="text-sm text-muted-foreground">{t('youCall')}</p>
          <p className="mt-1 font-serif text-4xl font-semibold">{locale === 'mn' ? result.mn : result.en}</p>
          <p className="mt-1 text-muted-foreground">{locale === 'mn' ? result.en : result.mn}</p>
        </div>
      )}
    </div>
  );
}
