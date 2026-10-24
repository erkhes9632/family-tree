'use client';
import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { CalendarPlus, Trash2 } from 'lucide-react';
import { comparePartialDates, formatPartialDate } from '@super-project/genealogy';
import { EVENT_TYPES, type EventType, type PartialDate, type Place } from '@super-project/types';
import { useApi } from '@/lib/api';
import { qk, useEvents, useInvalidatingMutation } from '@/lib/queries';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PartialDateInput } from '@/components/forms/partial-date-input';
import { formatPlace, PlaceInput } from '@/components/forms/place-input';

export function EventsList({ treeId, personId, canEdit }: { treeId: string; personId: string; canEdit: boolean }) {
  const t = useTranslations('events');
  const te = useTranslations('eventType');
  const tc = useTranslations('common');
  const locale = useLocale();
  const api = useApi();
  const events = useEvents(treeId, personId);
  const keys = [qk.events(treeId, personId), qk.timeline(treeId)];
  const remove = useInvalidatingMutation((id: string) => api.del(`/trees/${treeId}/events/${id}`), keys);
  const list = [...(events.data ?? [])].sort((a, b) => comparePartialDates(a.date, b.date));
  return (
    <div className="space-y-3">
      {canEdit && <NewEventDialog treeId={treeId} personId={personId} />}
      {!list.length ? (
        <EmptyState title={t('empty')} />
      ) : (
        <ol className="space-y-2">
          {list.map((e) => (
            <li key={e.id} className="flex items-start gap-3 rounded-lg border bg-card p-3">
              <span className="w-24 shrink-0 text-sm font-medium tabular-nums">{formatPartialDate(e.date, locale === 'mn' ? 'mn' : 'en') || '—'}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{e.title || te(e.type)}</p>
                <p className="text-xs text-muted-foreground">{[te(e.type), formatPlace(e.place)].filter(Boolean).join(' · ')}</p>
                {e.description && <p className="mt-1 text-sm">{e.description}</p>}
              </div>
              {canEdit && (
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label={tc('delete')}
                  onClick={async () => {
                    try {
                      await remove.mutateAsync(e.id);
                    } catch {
                      toast.error(tc('error'));
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function NewEventDialog({ treeId, personId }: { treeId: string; personId: string }) {
  const t = useTranslations('events');
  const te = useTranslations('eventType');
  const tc = useTranslations('common');
  const api = useApi();
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<EventType>('graduation');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [date, setDate] = React.useState<PartialDate | null>(null);
  const [place, setPlace] = React.useState<Place | null>(null);
  const create = useInvalidatingMutation((body: unknown) => api.post(`/trees/${treeId}/events`, body), [qk.events(treeId, personId), qk.timeline(treeId)]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <CalendarPlus /> {t('add')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle>{t('add')}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await create.mutateAsync({ personId, type, title: title || null, description: description || null, date, place });
              setOpen(false);
              setTitle('');
              setDescription('');
              setDate(null);
              setPlace(null);
            } catch {
              toast.error(tc('error'));
            }
          }}
        >
          <div className="grid gap-1.5">
            <Label>{t('type')}</Label>
            <Select value={type} onValueChange={(v) => setType(v as EventType)}>
              <SelectTrigger aria-label={t('type')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPES.filter((x) => x !== 'birth' && x !== 'death').map((x) => (
                  <SelectItem key={x} value={x}>
                    {te(x)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="ev-title">{t('title')}</Label>
            <Input id="ev-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <PartialDateInput id="ev-date" label={t('date')} value={date} onChange={setDate} />
          <PlaceInput id="ev-place" label={t('place')} value={place} onChange={setPlace} />
          <div className="grid gap-1.5">
            <Label htmlFor="ev-desc">{t('description')}</Label>
            <Textarea id="ev-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {tc('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
