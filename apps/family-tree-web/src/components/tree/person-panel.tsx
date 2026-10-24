'use client';
import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { ArrowDownToLine, ArrowUpToLine, ExternalLink, Fingerprint, LocateFixed, Plus, Trash2, Users } from 'lucide-react';
import { describeRelationship, formatPartialDate, lifeSpanLabel, type FamilyIndex } from '@super-project/genealogy';
import { RELATIVE_KINDS, type PersonSummary, type RelativeKind } from '@super-project/types';
import { Link } from '@/i18n/navigation';
import { useApi } from '@/lib/api';
import { qk, useInvalidatingMutation, usePerson } from '@/lib/queries';
import { initials } from '@/lib/utils';
import { useMediaQuery } from '@/hooks/use-media-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Separator } from '@/components/ui/misc';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { formatPlace } from '@/components/forms/place-input';
import { useTreeContext } from './tree-context';
import type { FocusMode } from '@super-project/genealogy';

export function PersonPanel({
  index,
  personId,
  onClose,
  onSelect,
  onAddRelative,
  onCenter,
  onFocus,
}: {
  index: FamilyIndex;
  personId: string | null;
  onClose: () => void;
  onSelect: (id: string) => void;
  onAddRelative: (id: string, r: RelativeKind) => void;
  onCenter: (id: string) => void;
  onFocus: (id: string, mode: FocusMode) => void;
}) {
  const tree = useTreeContext();
  const t = useTranslations('panel');
  const tr = useTranslations('relation');
  const tc = useTranslations('common');
  const tps = useTranslations('partnership');
  const locale = useLocale();
  const api = useApi();
  const isDesktop = useMediaQuery('(min-width: 768px)');
  const person = personId ? index.get(personId) : undefined;
  const details = usePerson(tree.id, personId);
  const viewer = tree.access.personId;

  const remove = useInvalidatingMutation(() => api.del(`/trees/${tree.id}/persons/${personId}`), [qk.graph(tree.id), qk.tree(tree.id)]);
  const claim = useInvalidatingMutation(() => api.post(`/trees/${tree.id}/persons/${personId}/claim`), [qk.graph(tree.id), qk.tree(tree.id), qk.me]);

  if (!person) return null;
  const kin = viewer && viewer !== person.id ? describeRelationship(index, viewer, person.id) : null;
  const sib = index.siblings(person.id);
  const parents = index.parents(person.id);
  const partnerships = index.partnerships(person.id);
  const children = index.children(person.id);

  const chip = (p: PersonSummary | undefined, note?: string) =>
    p && (
      <button key={p.id + (note ?? '')} type="button" onClick={() => onSelect(p.id)} className="flex items-center gap-2 rounded-full border bg-card py-1 pr-3 pl-1 text-sm hover:bg-muted">
        <span className="flex size-6 items-center justify-center overflow-hidden rounded-full bg-muted text-[0.65rem] font-semibold">
          { }
          {p.photoUrl ? <img src={p.photoUrl} alt="" className="size-full object-cover" /> : initials(p.givenName)}
        </span>
        {p.givenName}
        {note && <span className="text-xs text-muted-foreground">({note})</span>}
      </button>
    );

  const d = details.data;
  return (
    <Sheet open={!!personId} onOpenChange={(o) => !o && onClose()} modal={false}>
      <SheetContent side={isDesktop ? 'right' : 'bottom'} modal={false} closeLabel={tc('close')} onInteractOutside={(e) => e.preventDefault()} className="overflow-y-auto">
        <SheetHeader className="flex-row items-center gap-3">
          <div className="size-16 shrink-0 overflow-hidden rounded-full border bg-muted">
            { }
            {person.photoUrl ? <img src={person.photoUrl} alt="" className="size-full object-cover" /> : <span className="flex size-full items-center justify-center text-lg font-semibold text-muted-foreground">{initials(person.givenName)}</span>}
          </div>
          <div className="min-w-0">
            <SheetTitle className="truncate">
              {person.givenName}
              {!person.isLiving && <span className="ml-1 text-muted-foreground">†</span>}
            </SheetTitle>
            <SheetDescription className="truncate">{[person.patronymic, person.clanName].filter(Boolean).join(' · ') || ' '}</SheetDescription>
            <p className="text-sm tabular-nums">{lifeSpanLabel(person.birthDate, person.deathDate, person.isLiving)}</p>
          </div>
        </SheetHeader>

        <div className="space-y-5 p-4">
          {kin && kin.category !== 'none' && (
            <p className="rounded-lg bg-accent/60 px-3 py-2 text-sm">
              {t('toYou')}: <strong>{locale === 'mn' ? kin.mn : kin.en}</strong>
            </p>
          )}
          {person.id === viewer && <Badge variant="gold">{t('thisIsYou')}</Badge>}
          {person.redacted && <p className="text-xs text-muted-foreground">{t('redacted')}</p>}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {person.birthDate && (
              <>
                <dt className="text-muted-foreground">{t('born')}</dt>
                <dd>{[formatPartialDate(person.birthDate, locale === 'mn' ? 'mn' : 'en'), formatPlace(d?.birthPlace)].filter(Boolean).join(', ')}</dd>
              </>
            )}
            {person.deathDate && (
              <>
                <dt className="text-muted-foreground">{t('died')}</dt>
                <dd>{[formatPartialDate(person.deathDate, locale === 'mn' ? 'mn' : 'en'), formatPlace(d?.deathPlace)].filter(Boolean).join(', ')}</dd>
              </>
            )}
            {d?.occupation && (
              <>
                <dt className="text-muted-foreground">{t('occupation')}</dt>
                <dd>{d.occupation}</dd>
              </>
            )}
          </dl>
          {d?.biography && <p className="line-clamp-4 text-sm text-muted-foreground">{d.biography}</p>}

          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link href={`/trees/${tree.id}/people/${person.id}`}>
                <ExternalLink /> {t('openProfile')}
              </Link>
            </Button>
            {tree.access.canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline">
                    <Plus /> {t('addRelative')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {RELATIVE_KINDS.map((r) => (
                    <DropdownMenuItem key={r} onSelect={() => onAddRelative(person.id, r)}>
                      {tr(r)}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="ghost" onClick={() => onCenter(person.id)}>
              <LocateFixed /> {t('center')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onFocus(person.id, 'ancestors')}>
              <ArrowUpToLine /> {t('ancestors')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onFocus(person.id, 'descendants')}>
              <ArrowDownToLine /> {t('descendants')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onFocus(person.id, 'family')}>
              <Users /> {t('family')}
            </Button>
          </div>

          <Separator />

          <Section title={t('parents')}>{parents.map((p) => chip(index.get(p.id), p.type !== 'biological' ? tr(`linkShort.${p.type}`) : undefined))}</Section>
          <Section title={t('partners')}>
            {partnerships.map((pt) => chip(index.get(pt.person1Id === person.id ? pt.person2Id : pt.person1Id), pt.status !== 'married' ? tps(pt.status) : undefined))}
          </Section>
          <Section title={t('children')}>{children.map((c) => chip(index.get(c.id), c.type !== 'biological' ? tr(`linkShort.${c.type}`) : undefined))}</Section>
          <Section title={t('siblings')}>
            {sib.full.map((s) => chip(index.get(s)))}
            {sib.half.map((s) => chip(index.get(s), t('half')))}
            {sib.step.map((s) => chip(index.get(s), t('step')))}
          </Section>

          {(tree.access.role && !tree.access.personId && !person.userId) || tree.access.canEdit ? <Separator /> : null}
          <div className="flex flex-wrap gap-2">
            {tree.access.role && !tree.access.personId && !person.userId && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await claim.mutateAsync(undefined);
                    toast.success(t('claimed'));
                  } catch {
                    toast.error(tc('error'));
                  }
                }}
              >
                <Fingerprint /> {t('thisIsMe')}
              </Button>
            )}
            {tree.access.canEdit && (
              <ConfirmDialog
                trigger={
                  <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive">
                    <Trash2 /> {tc('delete')}
                  </Button>
                }
                title={t('deleteTitle', { name: person.givenName })}
                description={t('deleteText')}
                confirmLabel={tc('delete')}
                cancelLabel={tc('cancel')}
                onConfirm={async () => {
                  try {
                    await remove.mutateAsync(undefined);
                    toast.success(t('deleted'));
                    onClose();
                  } catch {
                    toast.error(tc('error'));
                  }
                }}
              />
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode[] }) {
  const items = React.Children.toArray(children).filter(Boolean);
  if (!items.length) return null;
  return (
    <section>
      <h3 className="mb-2 font-sans text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <div className="flex flex-wrap gap-1.5">{items}</div>
    </section>
  );
}
