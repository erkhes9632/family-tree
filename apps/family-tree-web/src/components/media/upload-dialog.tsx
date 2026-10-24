'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { FileUp, Upload } from 'lucide-react';
import { MEDIA_CATEGORIES, type MediaCategory, type PartialDate } from '@super-project/types';
import { useApi } from '@/lib/api';
import { useAlbums, useGraph } from '@/lib/queries';
import { kindForMime, uploadMedia, UploadValidationError } from '@/lib/upload';
import { formatBytes } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PartialDateInput } from '@/components/forms/partial-date-input';
import { PersonPicker } from './person-picker';

interface Item {
  file: File;
  progress: number;
  state: 'queued' | 'uploading' | 'done' | 'error';
  error?: string;
}

export function UploadDialog({ treeId, defaultPersonIds = [], defaultAlbumId, trigger }: { treeId: string; defaultPersonIds?: string[]; defaultAlbumId?: string; trigger?: React.ReactNode }) {
  const t = useTranslations('upload');
  const tcat = useTranslations('mediaCategory');
  const tc = useTranslations('common');
  const api = useApi();
  const qc = useQueryClient();
  const graph = useGraph(treeId);
  const albums = useAlbums(treeId);
  const [open, setOpen] = React.useState(false);
  const [items, setItems] = React.useState<Item[]>([]);
  const [category, setCategory] = React.useState<MediaCategory>('family');
  const [albumId, setAlbumId] = React.useState<string>(defaultAlbumId ?? 'none');
  const [personIds, setPersonIds] = React.useState<string[]>(defaultPersonIds);
  const [date, setDate] = React.useState<PartialDate | null>(null);
  const [place, setPlace] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const addFiles = (files: FileList | File[]) => setItems((prev) => [...prev, ...Array.from(files).map((file) => ({ file, progress: 0, state: 'queued' as const }))]);

  async function start() {
    setBusy(true);
    let ok = 0;
    for (let i = 0; i < items.length; i++) {
      if (items[i].state === 'done') continue;
      setItems((prev) => prev.map((it, j) => (j === i ? { ...it, state: 'uploading' } : it)));
      try {
        await uploadMedia(api, treeId, items[i].file, {
          meta: { category, albumId: albumId === 'none' ? null : albumId, personIds, date, place: place || null, title: items[i].file.name.replace(/\.[^.]+$/, '') },
          onProgress: (p) => setItems((prev) => prev.map((it, j) => (j === i ? { ...it, progress: p } : it))),
        });
        ok++;
        setItems((prev) => prev.map((it, j) => (j === i ? { ...it, state: 'done', progress: 1 } : it)));
      } catch (err) {
        const msg = err instanceof UploadValidationError ? (err.reason === 'size' ? t('tooLarge', { mb: err.maxMb ?? 0 }) : t('badType')) : err instanceof Error ? err.message : tc('error');
        setItems((prev) => prev.map((it, j) => (j === i ? { ...it, state: 'error', error: msg } : it)));
      }
    }
    setBusy(false);
    await qc.invalidateQueries({ queryKey: ['tree', treeId, 'media'] });
    await qc.invalidateQueries({ queryKey: ['tree', treeId, 'albums'] });
    if (ok) toast.success(t('done', { n: ok }));
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (busy) return;
        setOpen(o);
        if (!o) setItems([]);
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button>
            <Upload /> {t('button')}
          </Button>
        )}
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')} className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            addFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 text-center ${dragging ? 'border-primary bg-primary/5' : ''}`}
        >
          <FileUp className="size-8 text-muted-foreground" />
          <p className="text-sm">{t('drop')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            {t('choose')}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            hidden
            accept="image/*,video/*,audio/*,application/pdf"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <p className="text-xs text-muted-foreground">{t('limits')}</p>
        </div>
        {items.length > 0 && (
          <ul className="max-h-48 space-y-2 overflow-y-auto">
            {items.map((it, i) => (
              <li key={i} className="rounded-lg border p-2 text-sm">
                <div className="flex justify-between gap-2">
                  <span className="truncate">{it.file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatBytes(it.file.size)} · {kindForMime(it.file.type) ?? '?'}
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(it.progress * 100)}>
                  <div className={`h-full transition-all ${it.state === 'error' ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${it.state === 'error' ? 100 : it.progress * 100}%` }} />
                </div>
                {it.error && <p className="mt-1 text-xs text-destructive">{it.error}</p>}
              </li>
            ))}
          </ul>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label>{t('category')}</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as MediaCategory)}>
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
          <div className="grid gap-1.5">
            <Label>{t('album')}</Label>
            <Select value={albumId} onValueChange={setAlbumId}>
              <SelectTrigger aria-label={t('album')}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t('noAlbum')}</SelectItem>
                {albums.data?.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <PersonPicker persons={graph.data?.persons ?? []} value={personIds} onChange={setPersonIds} label={t('people')} />
        <div className="grid gap-3 sm:grid-cols-2">
          <PartialDateInput id="upload-date" label={t('date')} value={date} onChange={setDate} />
          <div className="grid gap-1.5">
            <Label htmlFor="upload-place">{t('place')}</Label>
            <Input id="upload-place" value={place} onChange={(e) => setPlace(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={start} disabled={busy || !items.some((i) => i.state !== 'done')}>
            {busy ? t('uploading') : t('start', { n: items.filter((i) => i.state !== 'done').length })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
