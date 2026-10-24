'use client';
import * as React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Download, FileText, Mic, Pencil, Play, Trash2 } from 'lucide-react';
import { formatPartialDate } from '@super-project/genealogy';
import { MEDIA_CATEGORIES, type MediaCategory, type MediaDto, type PartialDate, type PersonSummary } from '@super-project/types';
import { useApi } from '@/lib/api';
import { formatDuration } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { PartialDateInput } from '@/components/forms/partial-date-input';
import { PersonPicker } from './person-picker';

export function MediaGrid({ items, persons, canEdit, treeId }: { items: MediaDto[]; persons: PersonSummary[]; canEdit: boolean; treeId: string }) {
  const [open, setOpen] = React.useState<MediaDto | null>(null);
  const t = useTranslations('media');
  return (
    <>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((m) => (
          <li key={m.id}>
            <button type="button" onClick={() => setOpen(m)} className="group relative block aspect-square w-full overflow-hidden rounded-lg border bg-muted text-left focus-visible:outline-2 focus-visible:outline-ring">
              {m.thumbnailUrl ? (
                 
                <img src={m.thumbnailUrl} alt={m.title ?? m.originalName} loading="lazy" decoding="async" className="size-full object-cover transition-transform group-hover:scale-[1.03]" />
              ) : (
                <span className="flex size-full flex-col items-center justify-center gap-2 p-3 text-center text-muted-foreground">
                  {m.kind === 'audio' ? <Mic className="size-8" /> : m.kind === 'video' ? <Play className="size-8" /> : <FileText className="size-8" />}
                  <span className="line-clamp-2 text-xs">{m.title ?? m.originalName}</span>
                </span>
              )}
              {m.kind === 'video' && m.thumbnailUrl && (
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="rounded-full bg-black/55 p-2 text-white">
                    <Play className="size-5" />
                  </span>
                </span>
              )}
              {(m.kind === 'video' || m.kind === 'audio') && m.durationSec != null && (
                <span className="absolute right-1.5 bottom-1.5 rounded bg-black/60 px-1.5 text-xs text-white tabular-nums">{formatDuration(m.durationSec)}</span>
              )}
              <span className="sr-only">{t(`kind.${m.kind}`)}</span>
            </button>
          </li>
        ))}
      </ul>
      <MediaViewer media={open} onClose={() => setOpen(null)} persons={persons} canEdit={canEdit} treeId={treeId} />
    </>
  );
}

function MediaViewer({ media, onClose, persons, canEdit, treeId }: { media: MediaDto | null; onClose: () => void; persons: PersonSummary[]; canEdit: boolean; treeId: string }) {
  const t = useTranslations('media');
  const tcat = useTranslations('mediaCategory');
  const tc = useTranslations('common');
  const locale = useLocale();
  const api = useApi();
  const qc = useQueryClient();
  const [editing, setEditing] = React.useState(false);
  const [form, setForm] = React.useState<{ title: string; description: string; category: MediaCategory; date: PartialDate | null; place: string; personIds: string[] }>({
    title: '',
    description: '',
    category: 'other',
    date: null,
    place: '',
    personIds: [],
  });
  React.useEffect(() => {
    if (media) {
      setEditing(false);
      setForm({ title: media.title ?? '', description: media.description ?? '', category: media.category, date: media.date, place: media.place ?? '', personIds: media.personIds });
    }
  }, [media]);
  if (!media) return null;
  const names = media.personIds.map((id) => persons.find((p) => p.id === id)?.givenName).filter(Boolean);
  const refresh = () => qc.invalidateQueries({ queryKey: ['tree', treeId] });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent closeLabel={tc('close')} className="max-w-4xl gap-3 p-3 sm:p-4">
        <DialogTitle className="pr-8">{media.title || media.originalName}</DialogTitle>
        <DialogDescription className="sr-only">{t(`kind.${media.kind}`)}</DialogDescription>
        <div className="flex max-h-[60dvh] items-center justify-center overflow-hidden rounded-lg bg-black/90">
          {media.kind === 'photo' && media.url && (
             
            <img src={media.url} alt={media.title ?? media.originalName} className="max-h-[60dvh] w-auto object-contain" />
          )}
          {media.kind === 'video' && media.url && <video src={media.url} controls playsInline poster={media.thumbnailUrl ?? undefined} className="max-h-[60dvh] w-full" />}
          {media.kind === 'audio' && media.url && (
            <div className="w-full p-8">
              <audio src={media.url} controls className="w-full" />
            </div>
          )}
          {media.kind === 'document' && media.url && (media.mimeType === 'application/pdf' ? <iframe src={media.url} title={media.originalName} className="h-[60dvh] w-full bg-white" /> : (
             
            <img src={media.url} alt={media.originalName} className="max-h-[60dvh] object-contain" />
          ))}
        </div>

        {editing ? (
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.patch(`/trees/${treeId}/media/${media.id}`, { ...form, title: form.title || null, description: form.description || null, place: form.place || null });
                await refresh();
                toast.success(tc('saved'));
                onClose();
              } catch {
                toast.error(tc('error'));
              }
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="m-title">{t('title')}</Label>
                <Input id="m-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>{t('category')}</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as MediaCategory })}>
                  <SelectTrigger aria-label={t('category')}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEDIA_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {tcat(c)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="m-desc">{t('description')}</Label>
              <Textarea id="m-desc" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <PartialDateInput id="m-date" label={t('date')} value={form.date} onChange={(d) => setForm({ ...form, date: d })} />
              <div className="grid gap-1.5">
                <Label htmlFor="m-place">{t('place')}</Label>
                <Input id="m-place" value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} />
              </div>
            </div>
            <PersonPicker persons={persons} value={form.personIds} onChange={(ids) => setForm({ ...form, personIds: ids })} label={t('people')} />
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                {tc('cancel')}
              </Button>
              <Button type="submit">{tc('save')}</Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 space-y-1 text-sm">
              {media.description && <p>{media.description}</p>}
              <p className="text-muted-foreground">
                {[formatPartialDate(media.date, locale === 'mn' ? 'mn' : 'en'), media.place, tcat(media.category)].filter(Boolean).join(' · ')}
              </p>
              {names.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {names.map((n) => (
                    <Badge key={n} variant="secondary">
                      {n}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-1">
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    const { url } = await api.get<{ url: string }>(`/trees/${treeId}/media/${media.id}/download`, { format: 'json' });
                    window.location.assign(url);
                  } catch {
                    toast.error(tc('error'));
                  }
                }}
              >
                <Download /> {t('download')}
              </Button>
              {canEdit && (
                <>
                  <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                    <Pencil /> {tc('edit')}
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button size="sm" variant="ghost" className="text-destructive" aria-label={tc('delete')}>
                        <Trash2 />
                      </Button>
                    }
                    title={t('deleteTitle')}
                    description={t('deleteText')}
                    confirmLabel={tc('delete')}
                    cancelLabel={tc('cancel')}
                    onConfirm={async () => {
                      try {
                        await api.del(`/trees/${treeId}/media/${media.id}`);
                        await refresh();
                        onClose();
                      } catch {
                        toast.error(tc('error'));
                      }
                    }}
                  />
                </>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
