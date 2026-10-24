'use client';
import * as React from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { FolderPlus, ImageOff } from 'lucide-react';
import { MEDIA_KINDS } from '@super-project/types';
import { useApi } from '@/lib/api';
import { qk, useAlbums, useGraph, useInvalidatingMutation, useMediaList, useStories, type MediaFilter } from '@/lib/queries';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AudioStoryDialog } from '@/components/media/audio-recorder';
import { MediaGrid } from '@/components/media/media-grid';
import { StoryList } from '@/components/media/story-list';
import { UploadDialog } from '@/components/media/upload-dialog';
import { useTreeContext } from '@/components/tree/tree-context';

export default function MediaPage() {
  const tree = useTreeContext();
  const t = useTranslations('media');
  const [tab, setTab] = React.useState<'gallery' | 'stories'>('gallery');
  const [kind, setKind] = React.useState<string>('all');
  const [albumId, setAlbumId] = React.useState<string | null>(null);
  const filter: MediaFilter = { kind: kind === 'all' ? undefined : kind, albumId: albumId ?? undefined };
  const media = useMediaList(tree.id, filter);
  const albums = useAlbums(tree.id);
  const graph = useGraph(tree.id);
  const stories = useStories(tree.id);
  const items = media.data?.pages.flatMap((p) => p.items) ?? [];
  const persons = graph.data?.persons ?? [];

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{t('heading')}</h2>
        {tree.access.canEdit && (
          <div className="flex flex-wrap gap-2">
            <AudioStoryDialog treeId={tree.id} />
            <UploadDialog treeId={tree.id} defaultAlbumId={albumId ?? undefined} />
          </div>
        )}
      </div>
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'gallery' | 'stories')}>
        <TabsList>
          <TabsTrigger value="gallery">{t('gallery')}</TabsTrigger>
          <TabsTrigger value="stories">{t('stories')}</TabsTrigger>
        </TabsList>
        <TabsContent value="gallery" className="space-y-5">
          <section aria-label={t('albums')} className="flex gap-2 overflow-x-auto pb-1">
            <AlbumChip active={albumId === null} onClick={() => setAlbumId(null)} title={t('allMedia')} />
            {albums.data?.map((a) => (
              <AlbumChip key={a.id} active={albumId === a.id} onClick={() => setAlbumId(a.id)} title={a.title} count={a.mediaCount} cover={a.coverUrl} />
            ))}
            {tree.access.canEdit && <NewAlbumDialog treeId={tree.id} />}
          </section>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label={t('filterKind')}>
            {['all', ...MEDIA_KINDS].map((k) => (
              <Button key={k} size="sm" variant={kind === k ? 'default' : 'outline'} onClick={() => setKind(k)} aria-pressed={kind === k}>
                {t(`filter.${k as 'all'}`)}
              </Button>
            ))}
          </div>
          {media.isLoading ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {Array.from({ length: 8 }, (_, i) => (
                <Skeleton key={i} className="aspect-square" />
              ))}
            </div>
          ) : items.length ? (
            <>
              <MediaGrid items={items} persons={persons} canEdit={tree.access.canEdit} treeId={tree.id} />
              {media.hasNextPage && (
                <div className="flex justify-center">
                  <Button variant="outline" onClick={() => media.fetchNextPage()} disabled={media.isFetchingNextPage}>
                    {t('loadMore')}
                  </Button>
                </div>
              )}
            </>
          ) : (
            <EmptyState icon={<ImageOff />} title={t('empty')} description={tree.access.canEdit ? t('emptyText') : undefined} />
          )}
        </TabsContent>
        <TabsContent value="stories">
          {stories.isLoading ? <Skeleton className="h-40" /> : <StoryList stories={stories.data ?? []} persons={persons} canEdit={tree.access.canEdit} treeId={tree.id} />}
        </TabsContent>
      </Tabs>
    </main>
  );
}

function AlbumChip({ active, onClick, title, count, cover }: { active: boolean; onClick: () => void; title: string; count?: number; cover?: string | null }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn('flex shrink-0 items-center gap-2 rounded-lg border bg-card py-1.5 pr-3 pl-1.5 text-sm hover:bg-muted', active && 'border-primary ring-1 ring-primary')}
    >
      <span className="size-8 overflow-hidden rounded-md bg-muted">
        { }
        {cover && <img src={cover} alt="" className="size-full object-cover" />}
      </span>
      <span className="max-w-40 truncate">{title}</span>
      {count != null && <span className="text-xs text-muted-foreground">{count}</span>}
    </button>
  );
}

function NewAlbumDialog({ treeId }: { treeId: string }) {
  const t = useTranslations('media');
  const tc = useTranslations('common');
  const api = useApi();
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState('');
  const create = useInvalidatingMutation((v: { title: string }) => api.post(`/trees/${treeId}/albums`, v), [qk.albums(treeId)]);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-11 shrink-0">
          <FolderPlus /> {t('newAlbum')}
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')}>
        <DialogHeader>
          <DialogTitle>{t('newAlbum')}</DialogTitle>
        </DialogHeader>
        <form
          className="grid gap-3"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!title.trim()) return;
            try {
              await create.mutateAsync({ title: title.trim() });
              setOpen(false);
              setTitle('');
            } catch {
              toast.error(tc('error'));
            }
          }}
        >
          <Label htmlFor="album-title">{t('albumTitle')}</Label>
          <Input id="album-title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
          <DialogFooter>
            <Button type="submit" disabled={create.isPending}>
              {tc('create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
