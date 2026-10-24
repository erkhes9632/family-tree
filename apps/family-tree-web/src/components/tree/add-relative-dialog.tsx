'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Search } from 'lucide-react';
import { lifeSpanLabel, type FamilyIndex } from '@super-project/genealogy';
import {
  GENDERS,
  PARENT_LINK_TYPES,
  PARTNERSHIP_STATUSES,
  type Gender,
  type ParentLinkType,
  type PartialDate,
  type PartnershipStatus,
  type RelativeKind,
} from '@super-project/types';
import { ApiError, useApi } from '@/lib/api';
import { qk, useInvalidatingMutation } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PartialDateInput } from '@/components/forms/partial-date-input';

export interface AddRelativeTarget {
  personId: string;
  relation: RelativeKind;
}

export function AddRelativeDialog({
  treeId,
  index,
  target,
  onClose,
  onCreated,
}: {
  treeId: string;
  index: FamilyIndex;
  target: AddRelativeTarget | null;
  onClose: () => void;
  onCreated: (personId: string) => void;
}) {
  const t = useTranslations('addRelative');
  const tr = useTranslations('relation');
  const tg = useTranslations('gender');
  const tl = useTranslations('linkType');
  const tps = useTranslations('partnership');
  const tc = useTranslations('common');
  const api = useApi();

  const anchor = target ? index.get(target.personId) : undefined;
  const relation = target?.relation ?? 'child';
  const isParent = relation === 'father' || relation === 'mother';

  const [mode, setMode] = React.useState<'new' | 'existing'>('new');
  const [givenName, setGivenName] = React.useState('');
  const [patronymic, setPatronymic] = React.useState('');
  const [gender, setGender] = React.useState<Gender>('unknown');
  const [isLiving, setIsLiving] = React.useState(true);
  const [birthDate, setBirthDate] = React.useState<PartialDate | null>(null);
  const [deathDate, setDeathDate] = React.useState<PartialDate | null>(null);
  const [linkType, setLinkType] = React.useState<ParentLinkType>('biological');
  const [status, setStatus] = React.useState<PartnershipStatus>('married');
  const [otherParentId, setOtherParentId] = React.useState<string>('none');
  const [existingId, setExistingId] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState('');

  const partners = React.useMemo(() => (anchor ? index.partners(anchor.id).map((id) => index.get(id)).filter((p) => !!p) : []), [anchor, index]);

  // reset whenever the dialog opens for a new target
  React.useEffect(() => {
    if (!target || !anchor) return;
    setMode('new');
    setGivenName('');
    setGender(relation === 'father' ? 'male' : relation === 'mother' ? 'female' : 'unknown');
    setIsLiving(true);
    setBirthDate(null);
    setDeathDate(null);
    setLinkType('biological');
    setStatus('married');
    setExistingId(null);
    setQuery('');
    const firstPartner = partners[0];
    setOtherParentId(relation === 'child' && firstPartner ? firstPartner.id : 'none');
    // Mongolian patronymic: the father's given name
    let pat = '';
    if (relation === 'child') pat = anchor.gender === 'male' ? anchor.givenName : (firstPartner?.gender === 'male' ? firstPartner.givenName : '');
    if (relation === 'sibling') pat = anchor.patronymic ?? '';
    setPatronymic(pat);
    // intentionally keyed on the target only (re-initialise the form per open)
  }, [target?.personId, target?.relation]);

  React.useEffect(() => {
    if (relation !== 'child' || !anchor) return;
    const other = index.get(otherParentId);
    if (anchor.gender !== 'male' && other?.gender === 'male') setPatronymic(other.givenName);
  }, [otherParentId, relation, anchor, index]);

  const add = useInvalidatingMutation(
    (body: unknown) => api.post<{ personId: string }>(`/trees/${treeId}/persons/${target?.personId}/relatives`, body),
    [qk.graph(treeId), qk.tree(treeId)],
  );

  const candidates = React.useMemo(() => {
    if (!anchor) return [];
    const q = query.trim().toLowerCase();
    return [...index.persons.values()]
      .filter((p) => p.id !== anchor.id && (!q || `${p.givenName} ${p.patronymic ?? ''} ${p.clanName ?? ''}`.toLowerCase().includes(q)))
      .slice(0, 40);
  }, [index, anchor, query]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (mode === 'new' && !givenName.trim()) return;
    if (mode === 'existing' && !existingId) return;
    const body = {
      relation,
      linkType,
      partnershipStatus: status,
      otherParentId: relation === 'child' && otherParentId !== 'none' ? otherParentId : null,
      ...(mode === 'existing'
        ? { existingPersonId: existingId }
        : {
            person: {
              givenName: givenName.trim(),
              patronymic: patronymic.trim() || null,
              gender,
              isLiving,
              birthDate,
              deathDate: isLiving ? null : deathDate,
            },
          }),
    };
    try {
      const res = await add.mutateAsync(body);
      toast.success(t('added'));
      onCreated(res.personId);
      onClose();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : '';
      toast.error(code === 'needs_parent' ? t('needsParent') : err instanceof ApiError ? err.message : tc('error'));
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={tc('close')} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('title', { relation: tr(relation), name: anchor?.givenName ?? '' })}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <Tabs value={mode} onValueChange={(v) => setMode(v as 'new' | 'existing')}>
            <TabsList>
              <TabsTrigger value="new">{t('newPerson')}</TabsTrigger>
              <TabsTrigger value="existing">{t('existingPerson')}</TabsTrigger>
            </TabsList>
            <TabsContent value="new" className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="rel-given">{t('givenName')}</Label>
                  <Input id="rel-given" value={givenName} onChange={(e) => setGivenName(e.target.value)} required autoFocus />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="rel-pat">{t('patronymic')}</Label>
                  <Input id="rel-pat" value={patronymic} onChange={(e) => setPatronymic(e.target.value)} />
                </div>
                {!isParent && (
                  <div className="grid gap-1.5">
                    <Label>{t('gender')}</Label>
                    <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                      <SelectTrigger aria-label={t('gender')}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDERS.map((g) => (
                          <SelectItem key={g} value={g}>
                            {tg(g)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex items-center justify-between gap-2 self-end rounded-lg border px-3 py-2">
                  <Label htmlFor="rel-living">{t('living')}</Label>
                  <Switch id="rel-living" checked={isLiving} onCheckedChange={setIsLiving} />
                </div>
              </div>
              <PartialDateInput id="rel-birth" label={t('birthDate')} value={birthDate} onChange={setBirthDate} />
              {!isLiving && <PartialDateInput id="rel-death" label={t('deathDate')} value={deathDate} onChange={setDeathDate} />}
            </TabsContent>
            <TabsContent value="existing" className="grid gap-2">
              <div className="relative">
                <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder={t('searchPlaceholder')} aria-label={t('searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} />
              </div>
              <ul role="listbox" aria-label={t('existingPerson')} className="max-h-56 overflow-y-auto rounded-lg border">
                {candidates.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={existingId === p.id}
                      onClick={() => setExistingId(p.id)}
                      className={cn('flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted', existingId === p.id && 'bg-primary/10 font-medium')}
                    >
                      <span>
                        {p.givenName} <span className="text-muted-foreground">{p.patronymic}</span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">{lifeSpanLabel(p.birthDate, p.deathDate, p.isLiving)}</span>
                    </button>
                  </li>
                ))}
                {!candidates.length && <li className="px-3 py-4 text-center text-sm text-muted-foreground">{tc('noResults')}</li>}
              </ul>
            </TabsContent>
          </Tabs>

          <div className="grid gap-3 sm:grid-cols-2">
            {relation !== 'partner' && (
              <div className="grid gap-1.5">
                <Label>{t('linkType')}</Label>
                <Select value={linkType} onValueChange={(v) => setLinkType(v as ParentLinkType)}>
                  <SelectTrigger aria-label={t('linkType')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARENT_LINK_TYPES.map((l) => (
                      <SelectItem key={l} value={l}>
                        {tl(l)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(relation === 'partner' || isParent) && (
              <div className="grid gap-1.5">
                <Label>{relation === 'partner' ? t('partnershipStatus') : t('parentsStatus')}</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as PartnershipStatus)}>
                  <SelectTrigger aria-label={t('partnershipStatus')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PARTNERSHIP_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {tps(s)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {relation === 'child' && (
              <div className="grid gap-1.5">
                <Label>{t('otherParent')}</Label>
                <Select value={otherParentId} onValueChange={setOtherParentId}>
                  <SelectTrigger aria-label={t('otherParent')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t('unknownParent')}</SelectItem>
                    {partners.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.givenName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {tc('cancel')}
            </Button>
            <Button type="submit" disabled={add.isPending || (mode === 'new' ? !givenName.trim() : !existingId)}>
              {add.isPending ? tc('saving') : tc('add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
