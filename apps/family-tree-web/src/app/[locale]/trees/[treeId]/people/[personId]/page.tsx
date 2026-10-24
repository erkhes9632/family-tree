'use client';
import * as React from 'react';
import { use } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Camera, Fingerprint, Pencil, Quote } from 'lucide-react';
import { CLANS, describeRelationship, FamilyIndex, formatPartialDate, lifeSpanLabel } from '@super-project/genealogy';
import type { PersonDto } from '@super-project/types';
import { Link } from '@/i18n/navigation';
import { useApi } from '@/lib/api';
import { useAuthState } from '@/lib/auth';
import { qk, useGraph, useMediaList, usePerson, useStories } from '@/lib/queries';
import { initials } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { EmptyState, Skeleton } from '@/components/ui/misc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatPlace } from '@/components/forms/place-input';
import { AudioStoryDialog } from '@/components/media/audio-recorder';
import { MediaGrid } from '@/components/media/media-grid';
import { StoryList } from '@/components/media/story-list';
import { UploadDialog } from '@/components/media/upload-dialog';
import { EventsList } from '@/components/person/events-list';
import { HistoryList } from '@/components/person/history-list';
import { ProfileEditor } from '@/components/person/profile-editor';
import { useTreeContext } from '@/components/tree/tree-context';

export default function PersonPage({ params }: { params: Promise<{ personId: string }> }) {
  const { personId } = use(params);
  const tree = useTreeContext();
  const t = useTranslations('profile');
  const person = usePerson(tree.id, personId);
  const graph = useGraph(tree.id);
  const { userId } = useAuthState();
  const [editing, setEditing] = React.useState(false);

  if (person.isLoading) {
    return (
      <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6">
        <Skeleton className="h-40" />
        <Skeleton className="h-64" />
      </div>
    );
  }
  if (!person.data) return <EmptyState className="m-6" title={t('notFound')} />;
  const p = person.data;
  const canEditProfile = tree.access.canEdit || (!!userId && p.userId === userId && !tree.access.restricted);

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <Button asChild variant="ghost" size="sm" className="mb-3 -ml-2">
        <Link href={`/trees/${tree.id}`}>
          <ArrowLeft /> {t('backToTree')}
        </Link>
      </Button>
      <ProfileHeader person={p} index={graph.data ? new FamilyIndex(graph.data) : null} canEdit={canEditProfile} onEdit={() => setEditing(true)} />
      {editing ? (
        <div className="mt-6">
          <ProfileEditor person={p} treeId={tree.id} onDone={() => setEditing(false)} />
        </div>
      ) : (
        <ProfileTabs person={p} canEdit={canEditProfile} />
      )}
    </main>
  );
}

function ProfileHeader({ person: p, index, canEdit, onEdit }: { person: PersonDto; index: FamilyIndex | null; canEdit: boolean; onEdit: () => void }) {
  const tree = useTreeContext();
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const locale = useLocale();
  const api = useApi();
  const qc = useQueryClient();
  const viewer = tree.access.personId;
  const kin = index && viewer && viewer !== p.id ? describeRelationship(index, viewer, p.id) : null;
  const clan = p.clanId ? CLANS.find((c) => c.id === p.clanId) : undefined;

  return (
    <section className="flex flex-col gap-5 rounded-2xl border bg-card p-5 shadow-sm sm:flex-row">
      <div className="relative mx-auto shrink-0 sm:mx-0">
        <div className={`size-32 overflow-hidden rounded-2xl border bg-muted ${!p.isLiving ? 'grayscale-[40%]' : ''}`}>
          {p.photoUrl ? (
             
            <img src={p.photoUrl} alt={p.givenName} className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center font-serif text-4xl text-muted-foreground">{initials(p.givenName)}</span>
          )}
        </div>
        {canEdit && <PhotoChooser person={p} />}
      </div>
      <div className="min-w-0 flex-1 space-y-2 text-center sm:text-left">
        <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
          <h2 className="text-3xl font-semibold">
            {p.givenName}
            {!p.isLiving && <span className="ml-2 text-muted-foreground">†</span>}
          </h2>
          {p.userId && <Badge variant="blue">{t('hasAccount')}</Badge>}
          {p.id === viewer && <Badge variant="gold">{t('you')}</Badge>}
        </div>
        <p className="text-muted-foreground">
          {[p.patronymic && t('patronymicOf', { name: p.patronymic }), p.clanName && t('clanOf', { name: p.clanName })].filter(Boolean).join(' · ')}
          {clan && (
            <>
              {' · '}
              <Link href={`/culture/clans/${clan.slug}`} className="text-primary hover:underline">
                {locale === 'mn' ? clan.nameMn : clan.nameEn}
              </Link>
            </>
          )}
        </p>
        <p className="text-lg tabular-nums">{lifeSpanLabel(p.birthDate, p.deathDate, p.isLiving)}</p>
        {kin && kin.category !== 'none' && (
          <p className="text-sm">
            {t('toYou')}: <strong>{locale === 'mn' ? kin.mn : kin.en}</strong>
          </p>
        )}
        {p.redacted && <p className="text-xs text-muted-foreground">{t('redacted')}</p>}
        <div className="flex flex-wrap justify-center gap-2 pt-2 sm:justify-start">
          {canEdit && (
            <Button onClick={onEdit}>
              <Pencil /> {tc('edit')}
            </Button>
          )}
          {tree.access.role && !tree.access.personId && !p.userId && (
            <Button
              variant="outline"
              onClick={async () => {
                try {
                  await api.post(`/trees/${tree.id}/persons/${p.id}/claim`);
                  await qc.invalidateQueries({ queryKey: ['tree', tree.id] });
                  toast.success(t('claimed'));
                } catch {
                  toast.error(tc('error'));
                }
              }}
            >
              <Fingerprint /> {t('thisIsMe')}
            </Button>
          )}
        </div>
      </div>
      {p.nameMongolScript && (
        <div className="hidden items-center border-l pl-5 sm:flex" lang="mn-Mong" aria-label={t('mongolScript')}>
          <span className="mongol-script text-2xl leading-relaxed">{p.nameMongolScript}</span>
        </div>
      )}
    </section>
  );
}

function PhotoChooser({ person }: { person: PersonDto }) {
  const tree = useTreeContext();
  const t = useTranslations('profile');
  const tc = useTranslations('common');
  const api = useApi();
  const qc = useQueryClient();
  const [open, setOpen] = React.useState(false);
  const photos = useMediaList(tree.id, { personId: person.id, kind: 'photo' }, open);
  const items = photos.data?.pages.flatMap((pg) => pg.items) ?? [];
  const choose = async (mediaId: string | null) => {
    try {
      await api.patch(`/trees/${tree.id}/persons/${person.id}`, { profileMediaId: mediaId });
      await Promise.all([qc.invalidateQueries({ queryKey: qk.person(tree.id, person.id) }), qc.invalidateQueries({ queryKey: qk.graph(tree.id) })]);
      setOpen(false);
    } catch {
      toast.error(tc('error'));
    }
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="secondary" className="absolute -right-2 -bottom-2 rounded-full shadow" aria-label={t('changePhoto')}>
          <Camera />
        </Button>
      </DialogTrigger>
      <DialogContent closeLabel={tc('close')} className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{t('changePhoto')}</DialogTitle>
          <DialogDescription>{t('changePhotoText')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.map((m) => (
            <button key={m.id} type="button" onClick={() => choose(m.id)} className="aspect-square overflow-hidden rounded-lg border hover:ring-2 hover:ring-primary" aria-label={m.title ?? m.originalName}>
              { }
              <img src={m.thumbnailUrl ?? m.url ?? ''} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
        {!items.length && !photos.isLoading && <p className="text-sm text-muted-foreground">{t('noPhotos')}</p>}
        <div className="flex flex-wrap justify-between gap-2">
          <UploadDialog treeId={tree.id} defaultPersonIds={[person.id]} trigger={<Button variant="outline">{t('uploadPhoto')}</Button>} />
          {person.profileMediaId && (
            <Button variant="ghost" onClick={() => choose(null)}>
              {t('removePhoto')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProfileTabs({ person: p, canEdit }: { person: PersonDto; canEdit: boolean }) {
  const tree = useTreeContext();
  const t = useTranslations('profile');
  const graph = useGraph(tree.id);
  const media = useMediaList(tree.id, { personId: p.id });
  const stories = useStories(tree.id, p.id);
  const items = media.data?.pages.flatMap((pg) => pg.items) ?? [];
  const persons = graph.data?.persons ?? [];
  return (
    <Tabs defaultValue="about" className="mt-6">
      <TabsList>
        <TabsTrigger value="about">{t('tabs.about')}</TabsTrigger>
        <TabsTrigger value="media">
          {t('tabs.media')} {items.length > 0 && <span className="text-xs text-muted-foreground">{items.length}</span>}
        </TabsTrigger>
        <TabsTrigger value="stories">{t('tabs.stories')}</TabsTrigger>
        <TabsTrigger value="events">{t('tabs.events')}</TabsTrigger>
        {tree.access.role && <TabsTrigger value="history">{t('tabs.history')}</TabsTrigger>}
      </TabsList>
      <TabsContent value="about">
        <About person={p} />
      </TabsContent>
      <TabsContent value="media" className="space-y-4">
        {tree.access.canEdit && <UploadDialog treeId={tree.id} defaultPersonIds={[p.id]} />}
        {items.length ? <MediaGrid items={items} persons={persons} canEdit={tree.access.canEdit} treeId={tree.id} /> : <EmptyState title={t('noMedia')} />}
        {media.hasNextPage && (
          <Button variant="outline" onClick={() => media.fetchNextPage()}>
            {t('loadMore')}
          </Button>
        )}
      </TabsContent>
      <TabsContent value="stories" className="space-y-4">
        {tree.access.canEdit && <AudioStoryDialog treeId={tree.id} defaultPersonId={p.id} />}
        <StoryList stories={stories.data ?? []} persons={persons} canEdit={tree.access.canEdit} treeId={tree.id} />
      </TabsContent>
      <TabsContent value="events">
        <EventsList treeId={tree.id} personId={p.id} canEdit={canEdit} />
      </TabsContent>
      {tree.access.role && (
        <TabsContent value="history">
          <HistoryList treeId={tree.id} entityId={p.id} />
        </TabsContent>
      )}
    </Tabs>
  );
}

function About({ person: p }: { person: PersonDto }) {
  const t = useTranslations('profile');
  const tg = useTranslations('gender');
  const locale = useLocale();
  const L = locale === 'mn' ? 'mn' : 'en';
  const facts: [string, React.ReactNode][] = [
    [t('gender'), tg(p.gender)],
    [t('birth'), [formatPartialDate(p.birthDate, L), formatPlace(p.birthPlace)].filter(Boolean).join(' — ')],
    ...(!p.isLiving
      ? ([
          [t('death'), [formatPartialDate(p.deathDate, L), formatPlace(p.deathPlace)].filter(Boolean).join(' — ')],
          [t('burialPlace'), formatPlace(p.burialPlace)],
          [t('causeOfDeath'), p.causeOfDeath],
        ] as [string, React.ReactNode][])
      : ([[t('residence'), formatPlace(p.residence)]] as [string, React.ReactNode][])),
    [t('ethnicity'), p.ethnicity],
    [t('maidenName'), p.maidenName],
    [t('previousNames'), p.previousNames.join(', ')],
    [t('nicknames'), p.nicknames.join(', ')],
    [t('occupation'), p.occupation],
    [t('militaryService'), p.militaryService],
    [t('hobbies'), p.hobbies],
    [t('favorites'), p.favorites],
  ];
  const shown = facts.filter(([, v]) => v);
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="space-y-6">
        {p.messageToDescendants && (
          <section className="rounded-xl border-l-4 border-gold bg-accent/40 p-5">
            <h3 className="mb-2 text-lg font-semibold">{t('messageToDescendants')}</h3>
            <p className="font-serif text-lg whitespace-pre-line italic">{p.messageToDescendants}</p>
          </section>
        )}
        {p.biography ? (
          <section>
            <h3 className="mb-2 text-lg font-semibold">{t('biography')}</h3>
            <p className="leading-7 whitespace-pre-line">{p.biography}</p>
          </section>
        ) : (
          <p className="text-muted-foreground">{t('noBiography')}</p>
        )}
        {p.favoriteQuote && (
          <blockquote className="flex gap-3 text-lg italic">
            <Quote className="size-5 shrink-0 text-gold" /> {p.favoriteQuote}
          </blockquote>
        )}
        {!p.isLiving && p.memorial && (
          <section className="rounded-xl border bg-muted/40 p-5">
            <h3 className="mb-2 text-lg font-semibold">{t('memorial')}</h3>
            <p className="whitespace-pre-line">{p.memorial}</p>
          </section>
        )}
        {p.education.length > 0 && (
          <ListSection title={t('education')} items={p.education.map((e) => [e.institution, [e.field, e.degree, years(e.fromYear, e.toYear)].filter(Boolean).join(' · ')])} />
        )}
        {p.workplaces.length > 0 && (
          <ListSection title={t('workplaces')} items={p.workplaces.map((w) => [w.organization, [w.position, years(w.fromYear, w.toYear)].filter(Boolean).join(' · ')])} />
        )}
        {p.awards.length > 0 && <ListSection title={t('awards')} items={p.awards.map((a) => [a.title, [a.year, a.description].filter(Boolean).join(' · ')])} />}
        {p.achievements && (
          <section>
            <h3 className="mb-2 text-lg font-semibold">{t('achievements')}</h3>
            <p className="whitespace-pre-line">{p.achievements}</p>
          </section>
        )}
      </div>
      <aside className="space-y-4">
        <dl className="space-y-2 rounded-xl border bg-card p-4 text-sm">
          {shown.map(([k, v]) => (
            <div key={k}>
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-medium">{v}</dd>
            </div>
          ))}
        </dl>
        {p.contacts && (
          <dl className="space-y-2 rounded-xl border bg-card p-4 text-sm">
            <p className="font-medium">{t('sections.contacts')}</p>
            {Object.entries(p.contacts)
              .filter(([, v]) => v)
              .map(([k, v]) => (
                <div key={k}>
                  <dt className="text-muted-foreground">{t(k as 'phone')}</dt>
                  <dd className="break-words">{v}</dd>
                </div>
              ))}
          </dl>
        )}
        {p.customFields.length > 0 && (
          <dl className="space-y-2 rounded-xl border bg-card p-4 text-sm">
            <p className="font-medium">{t('sections.custom')}</p>
            {p.customFields.map((f) => (
              <div key={f.id}>
                <dt className="text-muted-foreground">{f.key}</dt>
                <dd className="whitespace-pre-line">{f.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </aside>
    </div>
  );
}

function years(a?: number | null, b?: number | null) {
  return a || b ? `${a ?? '?'}–${b ?? ''}` : '';
}

function ListSection({ title, items }: { title: string; items: [string, string][] }) {
  return (
    <section>
      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <ul className="space-y-2">
        {items.map(([a, b], i) => (
          <li key={i} className="rounded-lg border bg-card px-3 py-2">
            <p className="font-medium">{a}</p>
            {b && <p className="text-sm text-muted-foreground">{b}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
